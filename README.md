# auto-invest-engine

A small fintech microservices demo: users register (with email verification), place buy/sell orders, and the system asynchronously executes them, snapshots daily NAV, and reconciles stuck orders at midnight.

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
      │  JWT + email │          │  (orders, NAV)   │
      │  verify      │          └────┬────────┬────┘
      │  (Resend)    │               │        ▲
      └──────┬───────┘               ▼        │ consume
             │                 ┌──────────┐   │
             ▼                 │ RabbitMQ │◄──┤
         ┌─────────────┐       └────┬─────┘   │
         │  Postgres   │            ▲         │
         │ schemas:    │            │ publish │
         │  auth /     │       ┌────┴─────────────┐
         │  portfolio  │       │ scheduler-service│
         └─────────────┘       │ (cron jobs)      │
                               └──────────────────┘
```

### Services

- **app-service** ([services/app-service/src/index.ts](services/app-service/src/index.ts)) — Node/Express API gateway. Replaces the previous nginx ingress. Terminates client connections at `:8080`, applies Helmet + CORS (allow-list from `CORS_ORIGINS`) + global / auth-specific rate limits, verifies the user's JWT on protected routes, and forwards to upstream services via `http-proxy-middleware`. It mints a short-lived HMAC-signed `x-internal-auth` header (see [internal-token.ts](services/app-service/src/internal-token.ts)) so upstream services can trust the caller's identity without re-validating the JWT, and it strips any client-supplied internal headers before proxying ([auth.ts:36](services/app-service/src/auth.ts#L36)).
- **auth-service** ([services/auth-service/src/index.ts](services/auth-service/src/index.ts)) — owns user accounts. Endpoints: `POST /register`, `POST /login`, `POST /verify`, `POST /resend-verification`, `GET /me` ([auth.routes.ts](services/auth-service/src/routes/auth.routes.ts)). Bcrypt password hashing, JWT (HS256). Email verification is mandatory in non-dev environments; in `NODE_ENV=development` the account is auto-verified for convenience ([auth.service.ts:26](services/auth-service/src/services/auth.service.ts#L26)).
- **portfolio-service** — REST (`/orders`, `/portfolio`, `/nav`) + RabbitMQ consumers for order execution, NAV snapshots, and reconciliation. TypeORM against the `portfolio` schema.
- **scheduler-service** — pure worker. Cron-driven publisher of `nav.snapshot.requested`, `reconciliation.requested`, `order.sweep.requested` events.

### Gateway auth flow

1. Client sends `Authorization: Bearer <jwt>` to `app-service`.
2. `verifyUserJwt` validates the JWT against the shared `JWT_SECRET` and attaches `userId` / `email` to the request ([auth.ts:11](services/app-service/src/auth.ts#L11)).
3. `injectInternalAuth` derives a base64url-encoded HMAC-SHA256 token over `{sub, email, iat, nonce}` and sets `x-internal-auth`, `x-user-id`, `x-user-email` on the proxied request ([auth.ts:27](services/app-service/src/auth.ts#L27)).
4. Upstream services (auth, portfolio) trust requests bearing a valid `x-internal-auth` — they never see the raw JWT.
5. `/auth/login` and `/auth/register` are public but rate-limited (`RATE_LIMIT_AUTH_MAX`, default 10/min). Everything else under `/auth/*` and `/api/*` requires a valid JWT.

### Email verification flow

Registration in production mode ([auth.service.ts:19](services/auth-service/src/services/auth.service.ts#L19)):

1. `POST /auth/register` creates a `User(emailVerified=false)`.
2. `issueVerificationEmail` invalidates any prior tokens for the user, generates a 32-byte random token, stores **only** its SHA-256 hash in `verification_tokens(token_hash, expires_at)`, and sends the raw token via the `EmailService` (Resend API).
3. The link target is `${APP_URL}/verify?token=<raw>`. Client posts the token back to `POST /auth/verify`.
4. `verifyEmail` hashes the submitted token, looks up the row, checks `usedAt` / `expiresAt`, flips `users.emailVerified=true`, marks the token used, and returns a fresh JWT ([auth.service.ts:67](services/auth-service/src/services/auth.service.ts#L67)).
5. `POST /auth/resend-verification` rotates the token. Response is always the same generic message — the endpoint deliberately does not leak whether the address is registered.
6. `POST /auth/login` rejects unverified accounts with `403 email_not_verified`.

Token TTL is `EMAIL_VERIFICATION_TTL_HOURS` (default 24). Tokens are single-use and previous tokens are invalidated on resend.

### Order lifecycle

1. `POST /api/orders` writes an `Order(status=PENDING)` and publishes `order.created`.
2. The `portfolio.order-execution` consumer picks it up, computes a fill price (mocked deterministically by symbol), and inside a single Postgres transaction:
   - inserts the `messageId` into the `processed_messages` inbox (idempotency guard),
   - updates `Holding` (qty, avg cost) and `Portfolio.cashBalance`,
   - transitions `Order` → `EXECUTED` (or `FAILED` if the leg throws).
3. The midnight reconciliation cron publishes `reconciliation.requested`; the consumer flips any order still `PENDING` past the SLA → `FAILED` with a reason.

### Daily NAV

At 21:00 UTC on weekdays the scheduler publishes `nav.snapshot.requested{forDate}`. The consumer computes `cash + Σ(qty × markPrice)` per portfolio and `INSERT ... ON CONFLICT DO NOTHING` into `nav_snapshots(portfolioId, forDate)` — replays are safe.

## RabbitMQ topology

- Single durable topic exchange: `auto-invest.events`.
- Each consumer queue declared with `x-dead-letter-exchange: <queue>.dlx`; the DLX is a fanout bound to `<queue>.dlq`.
- Failed deliveries are rejected (no requeue) → DLX → DLQ. Retry count is read from the `x-death` header; once it exceeds `CONSUMER_MAX_RETRIES`, the message stays in the DLQ for human triage.
- Prefetch is set per-consumer via `CONSUMER_PREFETCH`.

### Idempotency

Every published envelope carries a UUID `messageId`. The first thing each consumer does is `INSERT INTO processed_messages(messageId)`; a `23505` unique-violation means "already processed" → ack and exit. The insert lives in the same Postgres tx as the side-effect, so partial replays cannot happen.

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

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

Postgres schemas `auth` and `portfolio` are created automatically by the init scripts in [scripts/db-init/](scripts/db-init/).

Then:

```bash
# register (dev: returns a token immediately; prod: returns "verification email sent")
curl -X POST http://localhost:8080/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"hunter2!"}'

# verify (prod only — token comes from the email)
curl -X POST http://localhost:8080/auth/verify \
  -H 'content-type: application/json' \
  -d '{"token":"<raw-token-from-email>"}'

# login
TOKEN=$(curl -s -X POST http://localhost:8080/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"hunter2!"}' | jq -r .token)

# place an order
curl -X POST http://localhost:8080/api/orders \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"symbol":"AAPL","side":"BUY","quantity":10}'

# view portfolio
curl http://localhost:8080/api/portfolio -H "authorization: Bearer $TOKEN"
```

RabbitMQ management UI: <http://localhost:15672> (user/pass from `.env`).

### Root npm scripts

The repo root ([package.json](package.json)) ships orchestration scripts so you don't have to remember the compose / per-service incantations:

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

## Layout

```
auto-invest-engine/
├── docker-compose.yml
├── package.json               # root orchestration scripts
├── .env.example
├── scripts/
│   ├── db-init/               # SQL run on Postgres first boot (auth + portfolio schemas)
│   ├── env-check.js
│   └── clean.js
├── shared/                    # @auto-invest/shared — rabbit helpers, event types, logger, errors
└── services/
    ├── app-service/           # API gateway (Node/Express; replaces nginx)
    ├── auth-service/          # accounts, JWT, email verification (Resend)
    ├── portfolio-service/     # orders, holdings, NAV
    └── scheduler-service/     # cron worker
```

## Trade-offs worth discussing

- **App-service vs nginx** — moving the gateway into Node lets us verify JWTs and mint the internal HMAC header in one hop, at the cost of an extra Node process in the request path. nginx would be cheaper but couldn't sign per-request internal tokens without an auth_request subrequest.
- **Shared `JWT_SECRET`** — app-service and auth-service share the secret so the gateway can verify tokens without calling auth on every request. In a larger system, prefer JWKS + asymmetric keys so only auth-service holds the private key, and have the gateway fetch the public set.
- **`x-internal-auth` is a bearer header** — upstreams must enforce it (and refuse direct external connections). In Docker we rely on the compose network; in production you'd lock upstream ports to the gateway's SG/namespace.
- **Single Postgres, two schemas** instead of per-service DBs — pragmatic for a demo; split for true service autonomy in production.
- **TypeORM `synchronize: true`** — fine for the demo; in prod use migrations.
- **Resend for email** — easy to wire up, but `EMAIL_FROM` defaults to Resend's sandbox sender; switch to a verified domain before going live.
- **Dev auto-verification** — convenient locally, but make sure `NODE_ENV` is never `development` in any deployed environment.
- **Mock market data** — `mockMarketPrice(symbol)` is deterministic. A real system would call a market-data service or read a price cache.
- **Reconciliation** here only fails stuck orders. Real reconciliation also cross-checks the broker's source-of-truth and may transition `PENDING → EXECUTED` based on confirmed fills.
