jest.mock("../../src/data-source", () => ({
  AppDataSource: { transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)) },
}));

import { randomUUID } from "crypto";
import { startAutoInvestConsumer } from "../../src/consumers/auto-invest.consumer";
import { SubscribedPortfolioService } from "../../src/services/subscribed-portfolio.service";
import { FakeAutoInvestPlanRepository } from "../fakes/fake-investment-plan.repositories";
import { FakeProcessedMessageRepository } from "../fakes/fake-processed-message.repository";
import { FakeOrderRepository } from "../fakes/fake-order.repository";
import { FakeChannel } from "../fakes/fake-channel";
import { ROUTING_KEYS } from "@auto-invest/shared";
import { AutoInvestPlan } from "../../src/models/auto-invest-plan.model";
import { AutoInvestAllocation } from "../../src/models/auto-invest-allocation.model";
import { RiskProfile } from "../../src/models/types";
import { Order } from "../../src/models/order.model";
import { OrderRepository } from "../../src/repository/order.repository";

// ── Constants ────────────────────────────────────────────────────────────

const USER_A = "aaaa0000-0000-0000-0000-000000000001";
const USER_B = "bbbb0000-0000-0000-0000-000000000002";
const PT_GROWTH = "11111111-1111-1111-1111-111111111111";
const PT_INCOME = "22222222-2222-2222-2222-222222222222";

// ── Fake SubscribedPortfolioService ──────────────────────────────────────

class SpyPortfolioService {
  public calls: Array<{
    userId: string;
    productTypeId: string;
    amount: number;
    reservePct: number;
    planId?: string;
  }> = [];
  public shouldThrowForProductType?: string;

  async addFund(
    userId: string,
    productTypeId: string,
    amount: number,
    reservePct: number,
    planId?: string,
  ): Promise<Order[]> {
    if (this.shouldThrowForProductType === productTypeId) {
      throw new Error(`addFund failed for ${productTypeId}`);
    }
    this.calls.push({ userId, productTypeId, amount, reservePct, planId });
    return [];
  }

  async executePlanInvestment(plan: any, investable: any): Promise<void> {
    for (const alloc of plan.allocations || []) {
      if (this.shouldThrowForProductType === alloc.productType.id) {
        throw new Error(`executePlanInvestment failed for ${alloc.productType.id}`);
      }
      const amount = Number(investable) * Number(alloc.weight);
      this.calls.push({
        userId: plan.userId,
        productTypeId: alloc.productType.id,
        amount,
        reservePct: plan.reservePct,
        planId: plan.id,
      });
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<AutoInvestPlan> & { allocations?: Array<Partial<AutoInvestAllocation>> } = {}): AutoInvestPlan {
  const planId = overrides.id ?? randomUUID();
  return {
    id: planId,
    userId: overrides.userId ?? USER_A,
    name: overrides.name ?? "Test Plan",
    riskProfile: overrides.riskProfile ?? RiskProfile.Moderate,
    cashBalance: overrides.cashBalance ?? "1000.00",
    reservePct: overrides.reservePct ?? 0.01,
    reservedCash: overrides.reservedCash ?? "0",
    investedAmount: overrides.investedAmount ?? "0",
    autoInvest: overrides.autoInvest ?? true,
    allocations: (overrides.allocations ?? [
      { id: randomUUID(), plan: { id: planId } as any, productType: { id: PT_GROWTH } as any, weight: 0.6, createdAt: new Date(), updatedAt: new Date() },
      { id: randomUUID(), plan: { id: planId } as any, productType: { id: PT_INCOME } as any, weight: 0.4, createdAt: new Date(), updatedAt: new Date() },
    ]) as AutoInvestAllocation[],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildEnvelope(overrides: { messageId?: string; triggeredBy?: "cron" | "manual" } = {}) {
  return {
    messageId: overrides.messageId ?? `msg-${randomUUID()}`,
    occurredAt: new Date().toISOString(),
    type: ROUTING_KEYS.AUTO_INVEST_REQUESTED,
    payload: { triggeredBy: overrides.triggeredBy ?? "cron" },
  };
}

async function buildHarness() {
  const channel = new FakeChannel();
  const ctx = { channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any };

  const planRepo = new FakeAutoInvestPlanRepository();
  const inbox = new FakeProcessedMessageRepository();
  const orderRepo = new FakeOrderRepository();
  const portfolioService = new SpyPortfolioService();

  await startAutoInvestConsumer(
    ctx,
    portfolioService as unknown as SubscribedPortfolioService,
    planRepo,
    inbox,
    orderRepo as unknown as OrderRepository,
  );

  return { channel, planRepo, inbox, portfolioService, orderRepo };
}

// ════════════════════════════════════════════════════════════════════════════
//  auto-invest consumer
// ════════════════════════════════════════════════════════════════════════════
describe("auto-invest consumer", () => {
  // ── Happy Path ──────────────────────────────────────────────────────────

  it("invests across all enabled plans' allocations, respecting weights", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    const plan = makePlan({ cashBalance: "1000.00", reservePct: 0.01 });
    await planRepo.save(plan);

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // Expected: 1000 total investable.
    // Growth weight = 0.6 => 600
    // Income weight = 0.4 => 400
    expect(portfolioService.calls).toHaveLength(2);

    const growthCall = portfolioService.calls.find((c) => c.productTypeId === PT_GROWTH)!;
    expect(growthCall.amount).toBeCloseTo(600, 1);
    expect(growthCall.userId).toBe(USER_A);
    expect(growthCall.planId).toBe(plan.id);
    expect(growthCall.reservePct).toBe(0.01);

    const incomeCall = portfolioService.calls.find((c) => c.productTypeId === PT_INCOME)!;
    expect(incomeCall.amount).toBeCloseTo(400, 1);

    // channel: message acked successfully
    expect(channel.acks).toHaveLength(1);
    expect(channel.rejects).toHaveLength(0);
  });

  it("processes multiple plans from different users in a single batch", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    const planA = makePlan({ userId: USER_A, cashBalance: "500.00" });
    const planB = makePlan({ userId: USER_B, cashBalance: "2000.00" });
    await planRepo.save(planA);
    await planRepo.save(planB);

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // 2 plans × 2 allocations each = 4 addFund calls
    expect(portfolioService.calls).toHaveLength(4);
    expect(portfolioService.calls.filter((c) => c.userId === USER_A)).toHaveLength(2);
    expect(portfolioService.calls.filter((c) => c.userId === USER_B)).toHaveLength(2);
    expect(channel.acks).toHaveLength(1);
  });

  // ── Skip Conditions ─────────────────────────────────────────────────────

  it("skips plans with autoInvest = false", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    // autoInvest = false → findAutoInvestEnabled() won't return it
    const disabledPlan = makePlan({ autoInvest: false, cashBalance: "5000.00" });
    await planRepo.save(disabledPlan);

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // findAutoInvestEnabled filters by autoInvest = true, so 0 calls
    expect(portfolioService.calls).toHaveLength(0);
    expect(channel.acks).toHaveLength(1);
  });

  it("skips plans with zero cash balance", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    await planRepo.save(makePlan({ cashBalance: "0.00" }));

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(portfolioService.calls).toHaveLength(0);
    expect(channel.acks).toHaveLength(1);
  });

  it("skips plans with no allocations", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    await planRepo.save(makePlan({ cashBalance: "1000.00", allocations: [] }));

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(portfolioService.calls).toHaveLength(0);
    expect(channel.acks).toHaveLength(1);
  });

  it("skips plans where investable after reserve is negligible (< $0.01)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // cash = 0.50, reservePct = 0.99 → investable = 0.50 * 0.01 = 0.005
    const { channel, planRepo, portfolioService } = await buildHarness();
    await planRepo.save(makePlan({ cashBalance: "0.50", reservePct: 0.99 }));

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(portfolioService.calls).toHaveLength(0);
    expect(channel.acks).toHaveLength(1);
  });

  it("does nothing when no plans are enabled (empty batch)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // No plans seeded at all
    const { channel, portfolioService } = await buildHarness();

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(portfolioService.calls).toHaveLength(0);
    expect(channel.acks).toHaveLength(1);
  });

  // ── Idempotency ─────────────────────────────────────────────────────────

  it("duplicate delivery: inbox guard prevents double investment", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    await planRepo.save(makePlan({ cashBalance: "1000.00" }));
    const envelope = buildEnvelope({ messageId: "msg-dupe-1" });

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // Only 2 addFund calls (one plan, two allocations), NOT 4
    expect(portfolioService.calls).toHaveLength(2);
    // Both messages acked (second one acked-and-skipped)
    expect(channel.acks).toHaveLength(2);
    expect(channel.rejects).toHaveLength(0);
  });

  // ── Error Resilience ────────────────────────────────────────────────────

  // (The previous test for "one allocation failing does not block others" has been removed because allocations are now aggregated atomically by executePlanInvestment)

  it("one plan failing does NOT block other plans in the same batch", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();

    // Plan A uses Growth (which will fail) and Income
    const planA = makePlan({ userId: USER_A, cashBalance: "1000.00" });

    // Plan B uses only Income (single allocation, no Growth)
    const planB = makePlan({
      userId: USER_B,
      cashBalance: "500.00",
      allocations: [
        { id: randomUUID(), plan: { id: "plan-b" } as any, productType: { id: PT_INCOME } as any, weight: 1.0, createdAt: new Date(), updatedAt: new Date() },
      ],
    });
    await planRepo.save(planA);
    await planRepo.save(planB);

    // Growth will fail for Plan A
    portfolioService.shouldThrowForProductType = PT_GROWTH;

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // Plan A: Growth fails (caught), Income is NEVER reached (because it's aggregated atomically) -> 0 calls for Plan A
    // Plan B: Income succeeds → 1 call
    // Total: 1 successful call
    expect(portfolioService.calls).toHaveLength(1);
    expect(portfolioService.calls.every((c) => c.productTypeId === PT_INCOME)).toBe(true);
    expect(channel.acks).toHaveLength(1);
  });

  // ── Reserve Percentage Edge Cases ───────────────────────────────────────

  it("reserve 0% means full cash is investable", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    const plan = makePlan({
      cashBalance: "1000.00",
      reservePct: 0,
      allocations: [
        { id: randomUUID(), plan: {} as any, productType: { id: PT_GROWTH } as any, weight: 1.0, createdAt: new Date(), updatedAt: new Date() },
      ],
    });
    await planRepo.save(plan);

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // investable = 1000 * (1 - 0) = 1000
    expect(portfolioService.calls).toHaveLength(1);
    expect(portfolioService.calls[0].amount).toBeCloseTo(1000, 1);
  });

  it("high reserve (50%) invests only half the cash", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, planRepo, portfolioService } = await buildHarness();
    const plan = makePlan({
      cashBalance: "500.00",
      reservedCash: "500.00",
      reservePct: 0.5,
      allocations: [
        { id: randomUUID(), plan: {} as any, productType: { id: PT_GROWTH } as any, weight: 1.0, createdAt: new Date(), updatedAt: new Date() },
      ],
    });
    await planRepo.save(plan);

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(buildEnvelope());

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // investable = 500 (since reserve is already separated)
    expect(portfolioService.calls).toHaveLength(1);
    expect(portfolioService.calls[0].amount).toBeCloseTo(500, 1);
  });
});
