# auto-invest-engine

A small fintech microservices demo: users register, place buy/sell orders, and the system asynchronously executes them, snapshots daily NAV, and reconciles stuck orders at midnight.

## Architecture

```
                   ┌─────────┐
       client ───► │  nginx  │ :8080
                   └────┬────┘
              /auth/*  │  /api/*
            ┌──────────┴───────────┐
            ▼                      ▼
    ┌──────────────┐       ┌──────────────────┐
    │ auth-service │       │ portfolio-service│
    │  (JWT)       │       │  (orders, NAV)   │
    └──────┬───────┘       └────┬────────┬────┘
           │                    │        ▲
           │                    ▼        │ consume
           │              ┌──────────┐   │
           ▼              │ RabbitMQ │◄──┤
       ┌─────────────┐    └────┬─────┘   │
       │  Postgres   │         ▲         │
       │ schemas:    │         │ publish │
       │  auth /     │    ┌────┴─────────────┐
       │  portfolio  │    │ scheduler-service│
       └─────────────┘    │ (cron jobs)      │
                          └──────────────────┘
```

### Services
- **auth-service** — `/register`, `/login`, `/me`. Bcrypt + JWT (HS256).
- **portfolio-service** — REST (`/orders`, `/portfolio`, `/nav`) + RabbitMQ consumers for order execution, NAV snapshots, and reconciliation. TypeORM against the `portfolio` schema.
- **scheduler-service** — pure worker. Cron-driven publisher of `nav.snapshot.requested`, `reconciliation.requested`, `order.sweep.requested` events.
- **nginx** — single ingress at `:8080`, routes `/auth/*` → auth-service, `/api/*` → portfolio-service.

### Order lifecycle
1. `POST /api/orders` writes an `Order(status=PENDING)` and publishes `order.created`.
2. The `portfolio.order-execution` consumer picks it up, computes a fill price (mocked deterministically by symbol), and inside a single Postgres transaction:
   - inserts the messageId into the `processed_messages` inbox (idempotency guard),
   - updates `Holding` (qty, avg cost) and `Portfolio.cashBalance`,
   - transitions `Order` → `EXECUTED` (or `FAILED` if the leg throws).
3. The midnight reconciliation cron publishes `reconciliation.requested`; the consumer flips any order still `PENDING` after the SLA → `FAILED` with a reason.

### Daily NAV
At 21:00 UTC on weekdays the scheduler publishes `nav.snapshot.requested{forDate}`. The consumer computes `cash + Σ(qty × markPrice)` per portfolio and `INSERT ... ON CONFLICT DO NOTHING` into `nav_snapshots(portfolioId, forDate)` — replays are safe.

## RabbitMQ topology

- Single durable topic exchange: `auto-invest.events`.
- Each consumer queue declared with `x-dead-letter-exchange: <queue>.dlx`; the DLX is a fanout bound to `<queue>.dlq`.
- Failed deliveries are rejected (no requeue) → DLX → DLQ. Retry count is read from the `x-death` header; once it exceeds `CONSUMER_MAX_RETRIES`, the message stays in the DLQ for human triage.
- Prefetch is set per-consumer via `CONSUMER_PREFETCH`.

### Idempotency
Every published envelope carries a UUID `messageId`. The first thing each consumer does is `INSERT INTO processed_messages(messageId)`; a `23505` unique-violation means "already processed" → ack and exit. The insert lives in the same Postgres tx as the side-effect, so partial replays cannot happen.

## Running locally

```bash
cp .env.example .env
docker compose up --build
```

Then:

```bash
# register
curl -X POST http://localhost:8080/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"a@b.com","password":"hunter2!"}'

# login (or reuse token from above)
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

## Layout

```
auto-invest-engine/
├── docker-compose.yml
├── .env.example
├── nginx/nginx.conf
├── shared/                  # @auto-invest/shared — rabbit helpers, event types, logger, errors
└── services/
    ├── auth-service/
    ├── portfolio-service/
    └── scheduler-service/
```

## Trade-offs worth discussing
- **Single Postgres, two schemas** instead of per-service DBs — pragmatic for a demo, but you'd split for true service autonomy in production.
- **TypeORM `synchronize: true`** — fine for the demo; in prod use migrations.
- **Mock market data** — `mockMarketPrice(symbol)` is deterministic. A real system would call a market-data service or read a price cache.
- **Reconciliation** here only fails stuck orders. Real reconciliation also cross-checks the broker's source-of-truth and may transition `PENDING → EXECUTED` based on confirmed fills.
- **JWT secret is shared** between auth- and portfolio-service via env. In a larger system, prefer JWKS + asymmetric keys so only auth-service holds the private key.
