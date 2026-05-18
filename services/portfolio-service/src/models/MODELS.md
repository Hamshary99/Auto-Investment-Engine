# Portfolio Service — Models Reference

Quick map of each entity in this folder, organized by the three layers of "portfolio truth" from [../../../../business_and_auto_invest.md](../../../../business_and_auto_invest.md). Use this as a sanity check while coding services, repositories, and consumers.

---

## Layer 1 — Catalog (admin, shared by all users)

No user cash, no shares. Admin-owned templates and recipes.

| Model | Purpose |
|---|---|
| [product-type.model.ts](./product-type.model.ts) | Sellable investment line (Savings, Tech Growth, …). Carries a `riskProfile` tag. Madkhol: `product_type`. |
| [associated-index-fund.model.ts](./associated-index-fund.model.ts) | Recipe inside a ProductType — `symbol` + `targetWeight`. Drives BUY symbol split when a ProductType receives cash. |
| [quiz-question.model.ts](./quiz-question.model.ts) | Risk survey question (text, displayOrder, isActive). |
| [quiz-answer.model.ts](./quiz-answer.model.ts) | Answer option for a question with `score`. Sum of scores → derives `RiskProfile`. |
| [risk-profile-template.model.ts](./risk-profile-template.model.ts) | Admin template: per `RiskProfile`, `weight` of each `ProductType`. **Source** for building a user's plan. |

---

## Layer 2 — User intent (per user, dollars only)

Per-user intent. Dollars and target % — still no shares.

| Model | Purpose |
|---|---|
| [auto-invest-plan.model.ts](./auto-invest-plan.model.ts) | One per user. Snapshots `riskProfile`, `reservePct`, `autoInvest` flag. Created from quiz result. |
| [auto-invest-allocation.model.ts](./auto-invest-allocation.model.ts) | Per-plan rows `{ productType, weight }` — **copied** from `RiskProfileTemplate` at quiz time (admin template changes don't silently rewrite users). Sum must = 100%. |
| [subscribed-portfolio.model.ts](./subscribed-portfolio.model.ts) | Per `(user, productType)` running totals of `investedAmount` / `redeemedAmount`. Dollar-level audit of how much committed to each product line. |

---

## Layer 3 — Executed reality (per user, shares + cash)

What the user actually owns after fills.

| Model | Purpose |
|---|---|
| [user-portfolio.model.ts](./user-portfolio.model.ts) | Cash bucket (`cashBalance`) + parent of holdings. One per user. |
| [holding.model.ts](./holding.model.ts) | Net share position by `symbol` — merged across all ProductTypes (no product attribution, by design). |
| [order.model.ts](./order.model.ts) | BUY/SELL audit trail with `status` (PENDING/FILLED/FAILED), `executedPrice`, `failureReason`. |
| [nav-snapshot.model.ts](./nav-snapshot.model.ts) | Daily `(userPortfolio, date) → navValue` for performance/recon. |
| [processed-message.model.ts](./processed-message.model.ts) | Idempotency inbox — PK on `messageId` blocks double-processing under at-least-once delivery. |

---

## Business flow — how the layers interact

### Onboarding (Layer 1 → Layer 2)

1. Admin seeds `ProductType` + `AssociatedIndexFund` rows.
2. Admin seeds `RiskProfileTemplate` rows per `RiskProfile` (conservative / moderate / aggressive).
3. Admin seeds `QuizQuestion` + `QuizAnswer` rows.
4. User submits quiz answers → sum `QuizAnswer.score` → map to a `RiskProfile`.
5. Upsert `AutoInvestPlan(userId, riskProfile, reservePct, autoInvest=true)`.
6. Replace the plan's `AutoInvestAllocation` rows by **copying** the matching `RiskProfileTemplate` rows (snapshot, not FK).

### Deposit / scheduled invest (Layer 2 → Layer 3)

7. Trigger = scheduler emits `auto.invest.requested` (Madkhol's payment-trigger equivalent). Optionally also a mock `POST /deposits`.
8. Consumer (gated by `ProcessedMessage` for idempotency) loads the user's `UserPortfolio` + `AutoInvestPlan` + allocations:
   - `investable = cashBalance − cashBalance × reservePct`
   - For each `AutoInvestAllocation`: `slice = investable × weight`
     - Call `SubscribedPortfolio.addFund(productType, slice)` → increment `investedAmount`, debit `UserPortfolio.cashBalance`.
     - For each `AssociatedIndexFund` of that ProductType, emit a BUY `Order` sized by `slice × targetWeight / stubPrice`.
9. Order-fill consumer flips `Order.status → FILLED` and upserts `Holding(symbol, qty, avgCost)`.

### Recon / reporting

10. NAV cron writes a `NavSnapshot` per user per day from `cashBalance + Σ(holding.qty × price)`.
11. Stuck-order recon scans `PENDING` orders older than threshold and re-publishes or fails them.

### Manual escape hatch

- `POST /product-types/:id/add-fund` skips the plan and calls `addFund` directly. Same Layer-3 effect, no allocation math, no quiz needed.

---

## Relationship map

### Big picture — entities across layers

```
┌─────────────────────── LAYER 1: CATALOG (admin) ───────────────────────┐
│                                                                        │
│   QuizQuestion ──1:N──► QuizAnswer                                     │
│       (text)              (score)                                      │
│                             │                                          │
│                             │ sum(score) ⇒ RiskProfile enum            │
│                             ▼                                          │
│   RiskProfileTemplate ──N:1──► ProductType ──1:N──► AssociatedIndexFund│
│   (riskProfile, weight)        (name,riskProfile)    (symbol,          │
│                                                       targetWeight)    │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ copy rows at quiz submit
                                 ▼
┌─────────────────────── LAYER 2: USER INTENT ───────────────────────────┐
│                                                                        │
│   AutoInvestPlan ──1:N──► AutoInvestAllocation ──N:1──► ProductType    │
│   (userId,                (weight)                                     │
│    riskProfile,                                                        │
│    reservePct,                                                         │
│    autoInvest)                                                         │
│                                                                        │
│   SubscribedPortfolio ──N:1──► ProductType                             │
│   (investedAmount,                                                     │
│    redeemedAmount) ──N:1──► UserPortfolio                              │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ consumer fires BUY orders
                                 ▼
┌─────────────────────── LAYER 3: EXECUTED REALITY ──────────────────────┐
│                                                                        │
│   UserPortfolio ──1:N──► Holding                                       │
│   (userId,               (symbol, quantity, avgCost)                   │
│    cashBalance)                                                        │
│                                                                        │
│   Order  (userId, symbol, side, qty, status)   ◄── fills update Holding│
│   NavSnapshot (userPortfolioId, forDate, navValue)                     │
│   ProcessedMessage (messageId)  ── idempotency inbox                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Cardinality cheat-sheet

```
UserPortfolio  1 ─── N  Holding              (one user, many symbols)
UserPortfolio  1 ─── N  SubscribedPortfolio  (one user, many product types)
UserPortfolio  1 ─── N  NavSnapshot          (one per day)

ProductType    1 ─── N  AssociatedIndexFund  (symbol recipe)
ProductType    1 ─── N  SubscribedPortfolio  (across users)
ProductType    1 ─── N  AutoInvestAllocation
ProductType    1 ─── N  RiskProfileTemplate

AutoInvestPlan 1 ─── N  AutoInvestAllocation (the plan's split)
QuizQuestion   1 ─── N  QuizAnswer

Order  ── standalone, references userId + symbol (no FK to Holding)
ProcessedMessage ── standalone, PK = messageId
```

### Dollar-flow vs share-flow (this is where Holding clicks)

```
        ┌──── DOLLARS axis ────┐        ┌──── SHARES axis ────┐
        │                      │        │                     │
  UserPortfolio.cashBalance    │        │   Holding(symbol,   │
        │                      │        │           quantity) │
        ▼                      │        ▲                     │
  AutoInvestAllocation.weight  │        │ Order(FILLED) updates
        │                      │        │                     │
        ▼                      │        │                     │
  SubscribedPortfolio          │        │                     │
  .investedAmount  ───────►  Order ─────┘                     │
  (per ProductType)            │  (per symbol, no             │
        │                      │   ProductType attribution)   │
        └──── splits by ───────┘                              │
              AssociatedIndexFund.targetWeight                │
```

---

## Why does `Holding` exist?

Short answer: **`Holding` is the only place that tracks shares you actually own.** Everything else in the system is dollars or percentages.

Walk the layers:

- `AutoInvestAllocation` says *"send 40% of my cash to the Tech product type"* — that's a **rule**, not a position.
- `SubscribedPortfolio.investedAmount` says *"I have committed $4,000 in dollars to Tech"* — that's a **dollar audit**, still not a position.
- `Order` says *"on May 18 we tried to BUY 2.5 shares of VTI"* — that's a **transaction event**.
- `Holding` says *"right now you own 12.345 shares of VTI at avg cost $98.20"* — that's the **current state**.

If you deleted `Holding`, you could *recompute* it by replaying every FILLED order — but every screen that shows "your positions / your NAV" would have to re-sum the entire order history on each request. `Holding` is the materialized aggregate of FILLED orders, kept fresh by the order-fill consumer.

**Why no `productTypeId` on `Holding`?** Because the same symbol (say VTI) might appear in multiple ProductTypes (Tech recipe AND Growth recipe both buy VTI). The user doesn't own "VTI-for-Tech" and "VTI-for-Growth" as separate share lots — they own VTI. ProductType-level dollar attribution lives in `SubscribedPortfolio` (Layer 2). Symbol-level share reality lives in `Holding` (Layer 3). Two different questions, two different tables.

**Concrete example:**
- Plan: 40% Tech, 40% Growth. Tech recipe = 100% VTI. Growth recipe = 50% VTI + 50% BND.
- $10k investable → Tech gets $4k (buys $4k VTI), Growth gets $4k (buys $2k VTI + $2k BND).
- `SubscribedPortfolio`: Tech=$4000, Growth=$4000.
- `Holding`: VTI = (4000+2000)/price shares, BND = 2000/price shares. **Merged**, not split by product.

---

## Key invariants (don't violate these)

- **Two distinct weight axes — do not collapse:**
  - `AutoInvestAllocation.weight` splits **user cash** across **ProductTypes**.
  - `AssociatedIndexFund.targetWeight` splits a **ProductType's slice** across **symbols**.
- `AutoInvestAllocation` rows are a **copy** of `RiskProfileTemplate`, not a foreign-key reference. Re-take quiz to re-sync.
- `Holding` has **no `productTypeId`** — positions merge by symbol. ProductType attribution lives only in `SubscribedPortfolio` (dollar level).
- Every consumer that mutates state must insert into `ProcessedMessage` in the **same transaction** as its side effect. PK violation = "already processed → ack".
- Sum of `AutoInvestAllocation.weight` per plan = 1.0. Sum of `AssociatedIndexFund.targetWeight` per ProductType = 1.0.
