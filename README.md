# auto-invest-engine

A fintech microservices demo: users register (with email verification), take a risk quiz to build an investment plan, place manual buy/sell orders or trigger auto-invest via a scheduler, and the system asynchronously executes orders, snapshots daily NAV, and reconciles stuck orders at midnight.

The domain terminology mirrors Madkhol's portfolio service — `ProductType`, `SubscribedPortfolio`, `AssociatedIndexFund`, `UserPortfolio`, `AutoInvestPlan`.

## Architecture

```
                       ┌──────────────────┐
           client ───► │   app-service    │ :8080
                        │  (API gateway)   │
                        │  • CORS / Helmet │
                        │  • rate limit    │
                        │  • JWT verify    │
                        │  • HMAC internal │
                        └────┬─────────────┘
                   /auth/*   │   /api/*
               ┌─────────────┴────────────┐
               ▼                          ▼
       ┌──────────────┐          ┌──────────────────┐
       │ auth-service │          │ portfolio-service│
       │  JWT + email │          │  orders, NAV,    │
       │  verify      │          │  quiz, plans,    │
       │  (Resend)    │          │  product-types   │
       └──────┬───────┘          └────┬────────┬────┘
              │                       │        ▲
              ▼                  ┌────▼────┐   │ consume
          ┌─────────────┐        │RabbitMQ │◄──┤
          │  Postgres   │        └────┬────┘   │
          │ schemas:    │             ▲        │
          │  auth /     │             │ publish│
          │  portfolio  │       ┌─────┴──────────────┐
          └─────────────┘       │ scheduler-service   │
                                │ (cron jobs)         │
                                └─────────────────────┘
```

### Services

- **app-service** ([services/app-service/src/index.ts](services/app-service/src/index.ts)) — Node/Express API gateway. Terminates client connections at `:8080`, applies Helmet + CORS (allow-list from `CORS_ORIGINS`) + global / auth-specific rate limits, verifies the user's JWT on protected routes, and forwards to upstream services via `http-proxy-middleware`. It mints a short-lived HMAC-signed `x-internal-auth` header ([internal-token.ts](services/app-service/src/internal-token.ts)) so upstreams can trust the caller's identity without re-validating the JWT, and strips any client-supplied internal headers before proxying ([auth.ts](services/app-service/src/auth.ts)).
- **auth-service** ([services/auth-service/src/index.ts](services/auth-service/src/index.ts)) — owns user accounts. Endpoints: `POST /register`, `POST /login`, `POST /verify`, `POST /resend-verification`, `GET /me`. Bcrypt password hashing, JWT (HS256). Email verification is mandatory in non-dev environments; in `NODE_ENV=development` the account is auto-verified ([auth.service.ts](services/auth-service/src/services/auth.service.ts)).
- **portfolio-service** — REST API (orders, user portfolio, product types, quiz, investment plans, NAV) + RabbitMQ consumers for order execution, NAV snapshots, and reconciliation. Domain terms match Madkhol: `ProductType`, `SubscribedPortfolio`, `AssociatedIndexFund`, `UserPortfolio`, `AutoInvestPlan`, `AutoInvestAllocation`. TypeORM against the `portfolio` schema.
- **scheduler-service** — pure cron worker. Publishes `nav.snapshot.requested`, `reconciliation.requested`, and `order.sweep.requested` on their configured schedules. The `auto.invest.requested` cron event is **planned** (see [Auto-invest pipeline](#auto-invest-pipeline) below).

### Gateway auth flow

1. Client sends `Authorization: Bearer <jwt>` to `app-service`.
2. `verifyUserJwt` validates the JWT against the shared `JWT_SECRET` and attaches `userId` / `email` to the request.
3. `injectInternalAuth` derives a base64url-encoded HMAC-SHA256 token over `{sub, email, iat, nonce}` and sets `x-internal-auth`, `x-user-id`, `x-user-email` on the proxied request.
4. Upstream services (auth, portfolio) trust requests bearing a valid `x-internal-auth` — they never see the raw JWT.
5. `/auth/login` and `/auth/register` are public but rate-limited (`RATE_LIMIT_AUTH_MAX`, default 10/min). Everything else under `/auth/*` and `/api/*` requires a valid JWT.

### Email verification flow

Registration in production mode ([auth.service.ts](services/auth-service/src/services/auth.service.ts)):

1. `POST /auth/register` creates a `User(emailVerified=false)`.
2. `issueVerificationEmail` invalidates any prior tokens for the user, generates a 32-byte random token, stores **only** its SHA-256 hash in `verification_tokens(token_hash, expires_at)`, and sends the raw token via the `EmailService` (Resend API).
3. The link target is `${APP_URL}/verify?token=<raw>`. Client posts the token back to `POST /auth/verify`.
4. `verifyEmail` hashes the submitted token, looks up the row, checks `usedAt` / `expiresAt`, flips `users.emailVerified=true`, marks the token used, and returns a fresh JWT.
5. `POST /auth/resend-verification` rotates the token. Response is always the same generic message — the endpoint deliberately does not leak whether the address is registered.
6. `POST /auth/login` rejects unverified accounts with `403 email_not_verified`.

Token TTL is `EMAIL_VERIFICATION_TTL_HOURS` (default 24). Tokens are single-use and previous tokens are invalidated on resend.

---

## Domain model — three layers of portfolio truth

```
┌──────────────── LAYER 1: CATALOG (admin) ──────────────────┐
│  ProductType ──1:N──► AssociatedIndexFund                   │
│  (name, riskProfile)   (symbol, targetWeight)               │
│                                                             │
│  QuizQuestion ──1:N──► QuizAnswer (score)                   │
│  RiskProfileTemplate  (riskProfile, weight, productType)    │
└───────────────────────────┬────────────────────────────────┘
                             │ quiz submit → copy template rows
                             ▼
┌──────────────── LAYER 2: USER INTENT (dollars) ────────────┐
│  AutoInvestPlan ──1:N──► AutoInvestAllocation               │
│  (userId, riskProfile,    (weight, productType)             │
│   reservePct, autoInvest)                                   │
│                                                             │
│  SubscribedPortfolio  (investedAmount, redeemedAmount)      │
│  per (userPortfolio, productType)                           │
└───────────────────────────┬────────────────────────────────┘
                             │ orders fill async
                             ▼
┌──────────────── LAYER 3: EXECUTED REALITY (shares) ────────┐
│  UserPortfolio (cashBalance) ──1:N──► Holding               │
│                                       (symbol, qty, avgCost)│
│  Order  (BUY/SELL, status, executedPrice)                   │
│  NavSnapshot  (userPortfolioId, forDate, navValue)          │
│  ProcessedMessage  (messageId) — idempotency inbox          │
└────────────────────────────────────────────────────────────┘
```

**Key invariants:**
- `AutoInvestAllocation.weight` splits **user cash** across **ProductTypes** (sum = 1.0).
- `AssociatedIndexFund.targetWeight` splits a **ProductType's slice** across **symbols** (sum = 1.0 per product type).
- `Holding` has **no `productTypeId`** — positions merge by symbol. ProductType attribution lives only in `SubscribedPortfolio`.
- Allocations are a **copy** of `RiskProfileTemplate` rows at quiz-submit time; admin template changes don't silently rewrite existing user plans.
- Every consumer that mutates state must insert into `ProcessedMessage` in the **same transaction** as its side effect. PK violation = already processed → ack.

---

## HTTP API

All routes except `/health` require the `x-internal-auth` header (minted by the gateway after JWT validation). Clients never call portfolio-service directly.

### User portfolio

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/user-portfolio` | Cash balance + current holdings for the authenticated user. Returns a zeroed stub if no portfolio exists yet. |
| `GET` | `/api/nav` | Latest `NavSnapshot` for the user, or `null`. |

### Orders

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/orders` | Place a manual BUY or SELL order. Writes `Order(status=PENDING)` and publishes `order.created`. Responds immediately — execution is async. |
| `GET` | `/api/orders/:id` | Fetch a single order (scoped to the authenticated user). |

### Product types (Madkhol: addFund / redeem)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/product-types` | List all active product types. |
| `GET` | `/api/product-types/:id` | Get a single active product type. |
| `POST` | `/api/product-types/:id/add-fund` | Manual invest: split `amount` across the product type's `AssociatedIndexFund` recipe and place BUY orders. Updates `SubscribedPortfolio.investedAmount`. |
| `POST` | `/api/product-types/:id/redeem` | Manual redeem: proportionally sell the product type's index-fund mix. Updates `SubscribedPortfolio.redeemedAmount`. |

### Quiz

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/quiz` | Fetch all active quiz questions with their answer options. |
| `POST` | `/api/quiz/submit` | Submit answers `[{ questionId, answerId }]`. Returns `{ totalScore, riskProfile }`. Does **not** create a plan — use the plan endpoint next. |

### Investment plans

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/plan` | List all investment plans for the authenticated user. |
| `GET` | `/api/plan/:id` | Get a single plan (ownership-scoped). |
| `POST` | `/api/plan/from-quiz` | Create a plan from a `riskProfile`. Loads the matching `RiskProfileTemplate` rows, validates them, copies allocations to the new plan. Body: `{ riskProfile, reservePct?, autoInvest? }`. |

---

## Order lifecycle

```
POST /api/orders ──► Order(status=PENDING) ──publish order.created──►
                                                                      │
                         consumer picks up                             │
                         executeOrderTx (single Postgres tx)          │
                         ┌─────────────────────────────────────────── ┤
                         │  1. markProcessed(messageId) — inbox guard  │
                         │  2. Ensure UserPortfolio exists             │
                         │  3. BUY: upsert Holding + debit cashBalance │
                         │     SELL: upsert Holding + credit cash      │
                         │  4. Order → EXECUTED                        │
                         └──────────────────────── ► FAILED (on throw) │
                                                                       │
midnight recon ──publish reconciliation.requested──► PENDING > 1 h → FAILED
```

- The `try { ... } catch { mark FAILED; throw }` pattern means the rethrow causes the whole transaction to roll back (including the FAILED write), so the message is redelivered and retried. After `CONSUMER_MAX_RETRIES` failed attempts the message is dead-lettered to the DLQ; the reconciliation cron catches any remaining PENDING orders on its next run.
- Both terminal states (`EXECUTED`, `FAILED`) are sticky — `executeOrderTx` short-circuits if the order is already non-PENDING, making redeliveries safe.

---

## Auto-invest pipeline

### What's built

| Step | Status |
|------|--------|
| Risk quiz (`GET /quiz`, `POST /quiz/submit`) | ✅ Done |
| Plan creation from quiz result (`POST /plan/from-quiz`) | ✅ Done |
| `AutoInvestPlan` + `AutoInvestAllocation` models | ✅ Done |
| Manual addFund / redeem via product-type routes | ✅ Done |
| `SubscribedPortfolio` dollar tracking | ✅ Done |
| `RiskProfileTemplate` catalog (seeded by admin) | ✅ Done |

### What's planned (next milestone)

The full auto-invest event loop is not yet wired:

```
[planned] Scheduler publishes auto.invest.requested
         │
         ▼
[planned] portfolio-service consumer (auto-invest.consumer.ts)
         │  for each user where plan.autoInvest = true:
         │    investable = cashBalance − cashBalance × reservePct
         │    for each AutoInvestAllocation:
         │      slice = investable × weight
         │      SubscribedPortfolioService.addFund(userId, productTypeId, slice)
         │      → places BUY orders per AssociatedIndexFund recipe
         │
         ▼ (already implemented)
         order.created → order-execution consumer → Holding + cash update
```

**Worked example** (moderate plan, $10,000 cash, 1% reserve):
- Investable: $9,900
- Allocations: 40% Tech Growth, 40% Savings, 20% Global — → $3,960 / $3,960 / $1,980
- Tech Growth recipe: 80% VTI + 20% AAPL → BUY orders placed; VTI holdings merged with any existing position

---

## Daily NAV

At 21:00 UTC on weekdays the scheduler publishes `nav.snapshot.requested{forDate}`. The consumer computes `cash + Σ(qty × markPrice)` per user portfolio and `INSERT ... ON CONFLICT DO NOTHING` into `nav_snapshots(userPortfolioId, forDate)` — replays are safe.

> **Note:** `markPrice` is currently stubbed to `holding.avgCost`. NAV therefore equals "cash + cost basis," not a real market valuation. Replace `markPrice` in [nav.service.ts](services/portfolio-service/src/services/nav.service.ts) with a real market-data call before going live.

---

## RabbitMQ topology

- Single durable topic exchange: `auto-invest.events`.
- Each consumer queue declared with `x-dead-letter-exchange: <queue>.dlx`; the DLX is a fanout bound to `<queue>.dlq`.
- Failed deliveries are rejected (no requeue) → DLX → DLQ. Retry count is read from the `x-death` header; once it exceeds `CONSUMER_MAX_RETRIES`, the message stays in the DLQ for human triage.
- Prefetch is set per-consumer via `CONSUMER_PREFETCH`.

### Routing keys

| Key | Publisher | Consumer |
|-----|-----------|----------|
| `order.created` | portfolio-service (on `POST /orders` and `addFund`) | `portfolio.order-execution` |
| `nav.snapshot.requested` | scheduler-service (cron) | `portfolio.nav-snapshot` |
| `reconciliation.requested` | scheduler-service (cron) | `portfolio.reconciliation` |
| `order.sweep.requested` | scheduler-service (cron) | `portfolio.reconciliation` |
| `auto.invest.requested` *(planned)* | scheduler-service (cron) | *(portfolio consumer — not yet built)* |

### Idempotency

Every published envelope carries a UUID `messageId`. The first thing each consumer does is `INSERT INTO processed_messages(messageId)`; a `23505` unique-violation means "already processed" → ack and exit. The insert lives in the same Postgres tx as the side-effect, so partial replays cannot happen.

---

## Configuration

Key environment variables (see [services/app-service/src/config.ts](services/app-service/src/config.ts) and [services/auth-service/src/config.ts](services/auth-service/src/config.ts)):

| Var | Used by | Default | Purpose |
|---|---|---|---|
| `APP_PORT` | app-service | `8080` (host) → `3000` | Public gateway port |
| `AUTH_UPSTREAM` | app-service | `http://auth-service:3001` | Auth upstream |
| `PORTFOLIO_UPSTREAM` | app-service | `http://portfolio-service:3002` | Portfolio upstream |
| `CORS_ORIGINS` | app-service | `http://localhost:3000,http://localhost:5173` | CORS allow-list (comma-separated) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` / `RATE_LIMIT_AUTH_MAX` | app-service | `60000` / `120` / `10` | Rate limiting |
| `TRUST_PROXY` | app-service | `false` | Set `true` behind a load balancer |
| `JWT_SECRET` | app-service, auth-service | `dev-secret` | HS256 signing key (shared) |
| `INTERNAL_AUTH_SECRET` | app-service, upstreams | `dev-internal-secret` | HMAC key for `x-internal-auth` |
| `INTERNAL_AUTH_TTL_MS` | app-service | `30000` | Internal token validity window |
| `JWT_EXPIRES_IN` | auth-service | `1h` | User JWT lifetime |
| `BCRYPT_ROUNDS` | auth-service | `10` | Password hash cost |
| `RESEND_API_KEY` | auth-service | — | Resend API key for verification mail |
| `EMAIL_FROM` | auth-service | `Auto Invest <onboarding@resend.dev>` | From address |
| `APP_URL` | auth-service | `http://localhost:3000` | Base URL embedded in verification links |
| `EMAIL_VERIFICATION_TTL_HOURS` | auth-service | `24` | Token expiry |
| `POSTGRES_*` | all | — | DB connection |
| `RABBITMQ_*` | portfolio, scheduler | — | Broker connection |
| `NODE_ENV` | auth-service | `development` | When `development`/`dev`, registration auto-verifies (no email sent) |

---

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

Postgres schemas `auth` and `portfolio` are created automatically by the init scripts in [scripts/db-init/](scripts/db-init/).

Then, a typical E2E flow:

```bash
# 1. Register (dev: returns token immediately; prod: returns "verification email sent")
curl -X POST http://localhost:8080/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"hunter2!"}'

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"hunter2!"}' | jq -r .token)

# 3. Take the risk quiz
curl http://localhost:8080/api/quiz -H "authorization: Bearer $TOKEN"

# 4. Submit quiz answers → get riskProfile
curl -X POST http://localhost:8080/api/quiz/submit \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '[{"questionId":"<q1-id>","answerId":"<a1-id>"},...]'

# 5. Create an investment plan from the quiz result
curl -X POST http://localhost:8080/api/plan/from-quiz \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"riskProfile":"moderate","reservePct":0.01,"autoInvest":true}'

# 6. Manually invest in a product type (escape hatch / manual top-up)
curl -X POST http://localhost:8080/api/product-types/<pt-id>/add-fund \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"amount":1000}'

# 7. View portfolio (cash + holdings)
curl http://localhost:8080/api/user-portfolio -H "authorization: Bearer $TOKEN"

# 8. Place a raw order directly
curl -X POST http://localhost:8080/api/orders \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","side":"BUY","quantity":10}'
```

RabbitMQ management UI: <http://localhost:15672> (user/pass from `.env`).

### Root npm scripts

```bash
npm run setup           # env check + install across shared + all services
npm run build:all       # build shared lib then each service
npm test                # run shared + auth + portfolio test suites

npm run dev:infra       # bring up postgres + rabbitmq only
npm run dev:all         # run all four services concurrently with ts-node-dev
npm run dev             # = dev:infra + dev:all

npm run up              # docker compose up --build -d
npm run up:fg           # foreground variant
npm run down            # stop
npm run down:clean      # stop + drop volumes
npm run logs            # tail all logs (logs:auth / :portfolio / :scheduler / :app for one)
npm run psql            # psql into the running Postgres
npm run health          # curl the gateway /health endpoint
```

---

## Layout

```
auto-invest-engine/
├── docker-compose.yml
├── package.json               # root orchestration scripts
├── .env.example
├── scripts/
│   ├── db-init/               # SQL run on Postgres first boot (auth + portfolio schemas)
│   ├── seed-dev.ts            # seeds quiz, product types, risk profile templates
│   ├── env-check.js
│   └── clean.js
├── shared/                    # @auto-invest/shared — rabbit helpers, event types, logger, errors
└── services/
    ├── app-service/           # API gateway (Node/Express)
    ├── auth-service/          # accounts, JWT, email verification (Resend)
    ├── portfolio-service/     # orders, holdings, NAV, quiz, plans, product-types
    │   └── src/
    │       ├── models/        # TypeORM entities (16 files) — see models/MODELS.md
    │       ├── services/      # business logic (order, nav, recon, quiz, plan, subscribed-portfolio)
    │       ├── controllers/   # Express request→service adapters
    │       ├── routes/        # route wiring (5 routers)
    │       ├── consumers/     # RabbitMQ handlers (order-execution, nav-snapshot, reconciliation)
    │       └── repository/    # thin TypeORM wrappers with optional tx param
    └── scheduler-service/     # cron worker (nav, recon, order-sweep)
```

---

## Trade-offs worth discussing

- **App-service vs nginx** — moving the gateway into Node lets us verify JWTs and mint the internal HMAC header in one hop. nginx would be cheaper but couldn't sign per-request internal tokens without an `auth_request` subrequest.
- **Shared `JWT_SECRET`** — app-service and auth-service share the secret so the gateway can verify tokens without calling auth on every request. In a larger system, prefer JWKS + asymmetric keys so only auth-service holds the private key.
- **`x-internal-auth` is a bearer header** — upstreams must enforce it (and refuse direct external connections). In Docker we rely on the compose network; in production you'd lock upstream ports to the gateway's SG/namespace.
- **Single Postgres, two schemas** instead of per-service DBs — pragmatic for a demo; split for true service autonomy in production.
- **TypeORM `synchronize: true`** — fine for the demo; in prod use migrations.
- **`decimal.js` for monetary math** — `subscribed-portfolio.service.ts` uses `Decimal` for all split/weight calculations. `order.service.ts` uses the `money.ts` utility helpers. Raw `Number` is avoided for financial values.
- **Demo seed of $100,000** — `ensureUserPortfolio` in `order.service.ts` seeds any new user with $100k on their first order. Remove before production.
- **Mock market data** — `mockMarketPrice(symbol)` in `order-execution.consumer.ts` is deterministic (hash mod 450). `getStubPrice(symbol)` in `price.stub.ts` is used by `subscribed-portfolio.service.ts`. Replace both with a real price source before going live.
- **Allocations are copied, not referenced** — `AutoInvestAllocation` rows are a snapshot of `RiskProfileTemplate` at quiz-submit time. Admin template changes don't silently rewrite user plans; users must retake the quiz to pick up changes.
- **Reconciliation SLA hard-coded** — the 60-minute PENDING cutoff in `reconciliation.service.ts` is a constant. Lift it to `config.ts` if you want to tune it without redeploying.
- **Dev auto-verification** — convenient locally, but make sure `NODE_ENV` is never `development` in any deployed environment.
- **Resend for email** — easy to wire up, but `EMAIL_FROM` defaults to Resend's sandbox sender; switch to a verified domain before going live.

---

## Documentation

| Doc | Purpose |
|-----|---------|
| [BUSINESS_AND_AUTO_INVEST.md](BUSINESS_AND_AUTO_INVEST.md) | Business model, Madkhol comparison, three-layer domain model, full auto-invest flow design |
| [HOLDINGS_AND_API_FLOW.md](HOLDINGS_AND_API_FLOW.md) | Why Holdings exist, dollar vs share axes, why granular APIs are correct for fintech |
| [services/portfolio-service/PORTFOLIO_SERVICE.md](services/portfolio-service/PORTFOLIO_SERVICE.md) | Deep dive: bootstrap, entities, async pipeline, code map, gotchas |
| [services/portfolio-service/src/models/MODELS.md](services/portfolio-service/src/models/MODELS.md) | Per-entity reference organized by the three layers; relationship map; key invariants |
| [BUSINESS_IMPLEMENTATION_ROADMAP.md](BUSINESS_IMPLEMENTATION_ROADMAP.md) | What to build next, phases, APIs, interview talking points |
