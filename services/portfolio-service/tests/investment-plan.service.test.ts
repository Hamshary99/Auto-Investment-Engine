/// <reference types="jest" />
// ─────────────────────────────────────────────────────────────────────────────
//  investment-plan.service.test.ts
//
//  Covers InvestmentPlanService:
//    • listPlansByUserId
//    • getPlanById
//    • createPlan                  (validation + happy path)
//    • createPlanFromRiskProfile   (happy path + missing template)
//    • updatePlanAllocations
//    • updatePlanPreferences
//    • deletePlan
//
//  Console output format:  INPUT → ACT → OUTPUT  per test.
// ─────────────────────────────────────────────────────────────────────────────

// Mock AppDataSource.transaction so callbacks run inline (no real DB).
jest.mock("../src/data-source", () => ({
  AppDataSource: {
    transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)),
  },
}));

import { InvestmentPlanService } from "../src/services/investment-plan.service";
import { ApiError }              from "../src/utils/error.handler";
import { RiskProfile }           from "../src/models/types";
import { ProductType }           from "../src/models/index";
import {
  FakeAutoInvestPlanRepository,
  FakeProductTypeForPlanRepository,
  FakeRiskProfileTemplateRepository,
} from "./fakes/fake-investment-plan.repositories";
import { FakeUserPortfolioRepository } from "./fakes/fake-user-portfolio.repository";

// ── shared pretty-printer ────────────────────────────────────────────────────

function logTestIO(label: string, input: unknown, output: unknown) {
  const sep = "─".repeat(60);
  console.log(`\n${sep}\n  🧪  ${label}\n  📥  INPUT  : ${JSON.stringify(input)}\n  📤  OUTPUT : ${JSON.stringify(output)}\n${sep}`);
}

// ── fixed test IDs ────────────────────────────────────────────────────────────

const USER_A   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B   = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PT_BONDS = "11111111-1111-1111-1111-111111111111";
const PT_EQUIT = "22222222-2222-2222-2222-222222222222";

// ── system-under-test factory ─────────────────────────────────────────────────

function buildSut() {
  const planRepo         = new FakeAutoInvestPlanRepository();
  const productTypeRepo  = new FakeProductTypeForPlanRepository(null as any);
  const riskTemplateRepo = new FakeRiskProfileTemplateRepository(null as any);
  const userPortfolioRepo = new FakeUserPortfolioRepository();

  const service = new InvestmentPlanService(
    planRepo as any,
    productTypeRepo as any,
    riskTemplateRepo as any,
    userPortfolioRepo as any
  );

  // seed two active product types
  productTypeRepo.seed({ id: PT_BONDS, name: "Bonds",    isActive: true } as ProductType);
  productTypeRepo.seed({ id: PT_EQUIT, name: "Equities", isActive: true } as ProductType);

  return { service, planRepo, productTypeRepo, riskTemplateRepo };
}

// ── shared allocation that sums to 1.0 ───────────────────────────────────────
const VALID_ALLOCATIONS = [
  { productTypeId: PT_BONDS, weight: 0.4 },
  { productTypeId: PT_EQUIT, weight: 0.6 },
];

// ════════════════════════════════════════════════════════════════════════════
//  listPlansByUserId
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.listPlansByUserId", () => {

  it("returns only plans belonging to the requested user", async () => {
    const { service } = buildSut();

    // create 2 plans for USER_A, 1 for USER_B
    await service.createPlan({ userId: USER_A, name: "Plan A1", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS });
    await service.createPlan({ userId: USER_A, name: "Plan A2", reservePct: 0.02, autoInvest: false, allocations: VALID_ALLOCATIONS });
    await service.createPlan({ userId: USER_B, name: "Plan B1", reservePct: 0.01, autoInvest: true,  allocations: VALID_ALLOCATIONS });

    const input  = { userId: USER_A };
    const output = await service.listPlansByUserId(input.userId);

    logTestIO("listPlansByUserId → 2 plans for USER_A", input, output.map((p) => ({ id: p.id, name: p.name, userId: p.userId })));

    expect(output).toHaveLength(2);
    expect(output.every((p) => p.userId === USER_A)).toBe(true);
  });

  it("returns empty array when user has no plans", async () => {
    const { service } = buildSut();
    const input  = { userId: USER_A };
    const output = await service.listPlansByUserId(input.userId);

    logTestIO("listPlansByUserId → [] (no plans)", input, output);

    expect(output).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  getPlanById
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.getPlanById", () => {

  it("returns the plan when it belongs to the requesting user", async () => {
    const { service } = buildSut();
    const created = await service.createPlan({
      userId: USER_A, name: "My Plan", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });

    const input  = { planId: created.id, userId: USER_A };
    const output = await service.getPlanById(input.planId, input.userId);

    logTestIO("getPlanById → found", input, { id: output.id, name: output.name });

    expect(output.id).toBe(created.id);
  });

  it("throws ApiError(404) when plan belongs to a different user", async () => {
    const { service } = buildSut();
    const created = await service.createPlan({
      userId: USER_A, name: "My Plan", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });

    const input = { planId: created.id, userId: USER_B };
    const err   = await service.getPlanById(input.planId, input.userId).catch((e) => e);

    logTestIO("getPlanById → 404 (wrong user)", input, { error: err.message, statusCode: err.statusCode });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });

  it("throws ApiError(404) for a completely unknown plan id", async () => {
    const { service } = buildSut();
    const input = { planId: "no-such-plan", userId: USER_A };
    const err   = await service.getPlanById(input.planId, input.userId).catch((e) => e);

    logTestIO("getPlanById → 404 (unknown plan)", input, { error: err.message, statusCode: err.statusCode });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  createPlan  — validation guards
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.createPlan – validation", () => {

  it("throws 400 when name is empty", async () => {
    const { service } = buildSut();
    const input = { userId: USER_A, name: "   ", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS };
    const err   = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 empty name", { name: input.name }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/plan name is required/i);
  });

  it("throws 400 when name exceeds 80 characters", async () => {
    const { service } = buildSut();
    const input = { userId: USER_A, name: "x".repeat(81), reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS };
    const err   = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 name too long", { nameLength: input.name.length }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/plan name too long/i);
  });

  it("throws 400 when reservePct is out of range", async () => {
    const { service } = buildSut();
    const input = { userId: USER_A, name: "Plan", reservePct: 1.5, autoInvest: true, allocations: VALID_ALLOCATIONS };
    const err   = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 invalid reservePct", { reservePct: input.reservePct }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/reservePct must be between 0 and 1/i);
  });

  it("throws 400 when allocations are empty", async () => {
    const { service } = buildSut();
    const input = { userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true, allocations: [] };
    const err   = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 empty allocations", { allocations: [] }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/at least one allocation/i);
  });

  it("throws 400 when allocation weights do not sum to 1.0", async () => {
    const { service } = buildSut();
    const input = {
      userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true,
      allocations: [{ productTypeId: PT_BONDS, weight: 0.3 }, { productTypeId: PT_EQUIT, weight: 0.3 }],
    };
    const err = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 weights don't sum to 1", { weightsSum: 0.6 }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/must sum to 1\.0/i);
  });

  it("throws 400 when duplicate productTypeId in allocations", async () => {
    const { service } = buildSut();
    const input = {
      userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true,
      allocations: [
        { productTypeId: PT_BONDS, weight: 0.5 },
        { productTypeId: PT_BONDS, weight: 0.5 }, // duplicate
      ],
    };
    const err = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 duplicate productTypeId", { duplicateId: PT_BONDS }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/duplicate allocation/i);
  });

  it("throws 400 when a productTypeId is unknown or inactive", async () => {
    const { service } = buildSut();
    const input = {
      userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true,
      allocations: [{ productTypeId: "unknown-id", weight: 1.0 }],
    };
    const err = await service.createPlan(input).catch((e) => e);

    logTestIO("createPlan → 400 unknown productType", { productTypeId: "unknown-id" }, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/unknown or inactive product types/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  createPlan  — happy path
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.createPlan – happy path", () => {

  it("persists a plan with correct allocations and returns full graph", async () => {
    const { service, planRepo } = buildSut();

    const input = {
      userId: USER_A,
      name: "Conservative Portfolio",
      reservePct: 0.05,
      autoInvest: true,
      allocations: VALID_ALLOCATIONS,
    };

    // ── ACT ───────────────────────────────────────────────────────────
    const output = await service.createPlan(input);

    logTestIO("createPlan → success", input, {
      id:          output.id,
      name:        output.name,
      userId:      output.userId,
      reservePct:  output.reservePct,
      autoInvest:  output.autoInvest,
      allocations: output.allocations.map((a) => ({
        productTypeId: a.productType.id,
        weight: a.weight,
      })),
    });

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // plan row created, allocations attached, data matches input
    expect(output).toMatchObject({
      userId:     USER_A,
      name:       "Conservative Portfolio",
      reservePct: 0.05,
      autoInvest: true,
    });
    expect(output.allocations).toHaveLength(2);
    expect(planRepo.all()).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  createPlanFromRiskProfile
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.createPlanFromRiskProfile", () => {

  it("creates a plan seeded from the risk-profile template", async () => {
    const { service, riskTemplateRepo } = buildSut();

    // seed a moderate template: 40% bonds, 60% equities
    riskTemplateRepo.seed({ riskProfile: RiskProfile.Moderate, productType: { id: PT_BONDS } as any, weight: 0.4 });
    riskTemplateRepo.seed({ riskProfile: RiskProfile.Moderate, productType: { id: PT_EQUIT } as any, weight: 0.6 });

    const input = { userId: USER_A, riskProfile: RiskProfile.Moderate };

    // ── ACT ───────────────────────────────────────────────────────────
    const output = await service.createPlanFromRiskProfile(input);

    logTestIO("createPlanFromRiskProfile → Moderate", input, {
      id:          output.id,
      name:        output.name,
      riskProfile: output.riskProfile,
      allocations: output.allocations.map((a) => ({ productTypeId: a.productType.id, weight: a.weight })),
    });

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // auto-generated name contains "Moderate", profile = moderate
    expect(output.riskProfile).toBe(RiskProfile.Moderate);
    expect(output.name).toMatch(/moderate/i);
    expect(output.allocations).toHaveLength(2);
  });

  it("throws 400 when no template exists for the given risk profile", async () => {
    const { service } = buildSut();
    // no templates seeded for Conservative
    const input = { userId: USER_A, riskProfile: RiskProfile.Conservative };
    const err   = await service.createPlanFromRiskProfile(input).catch((e) => e);

    logTestIO(
      "createPlanFromRiskProfile → 400 no template",
      input,
      { error: err.message, statusCode: err.statusCode },
    );

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/no risk profile template/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  updatePlanAllocations
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.updatePlanAllocations", () => {

  it("replaces allocations without changing riskProfile", async () => {
    const { service } = buildSut();
    const plan = await service.createPlan({
      userId: USER_A, name: "Initial", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS, riskProfile: RiskProfile.Conservative
    });

    const input = {
      planId: plan.id,
      userId: USER_A,
      allocations: [
        { productTypeId: PT_BONDS, weight: 0.2 },
        { productTypeId: PT_EQUIT, weight: 0.8 },
      ],
    };

    // ── ACT ───────────────────────────────────────────────────────────
    const output = await service.updatePlanAllocations(input);

    logTestIO("updatePlanAllocations → success", input, {
      riskProfile: output.riskProfile,
      allocations: output.allocations.map((a) => ({ weight: a.weight })),
    });

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // allocations replaced (still 2)
    expect(output.riskProfile).toBe(RiskProfile.Conservative);
    expect(output.allocations).toHaveLength(2);
  });

  it("throws 404 when plan does not belong to the requesting user", async () => {
    const { service } = buildSut();
    const plan = await service.createPlan({
      userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });

    const input = { planId: plan.id, userId: USER_B, riskProfile: RiskProfile.Aggressive, allocations: VALID_ALLOCATIONS };
    const err   = await service.updatePlanAllocations(input).catch((e) => e);

    logTestIO("updatePlanAllocations → 404 wrong user", { userId: USER_B }, { error: err.message, statusCode: err.statusCode });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  updatePlanPreferences
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.updatePlanPreferences", () => {

  it("patches name, reservePct, and autoInvest independently", async () => {
    const { service } = buildSut();
    const plan = await service.createPlan({
      userId: USER_A, name: "Old Name", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });

    const input = { planId: plan.id, userId: USER_A, name: "New Name", reservePct: 0.1, autoInvest: false };

    // ── ACT ───────────────────────────────────────────────────────────
    const output = await service.updatePlanPreferences(input);

    logTestIO("updatePlanPreferences → success", input, {
      name: output.name, reservePct: output.reservePct, autoInvest: output.autoInvest,
    });

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(output.name).toBe("New Name");
    expect(output.reservePct).toBe(0.1);
    expect(output.autoInvest).toBe(false);
  });

  it("throws 400 when new reservePct is out of range", async () => {
    const { service } = buildSut();
    const plan = await service.createPlan({
      userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });

    const input  = { planId: plan.id, userId: USER_A, reservePct: -0.5 };
    const err    = await service.updatePlanPreferences(input).catch((e) => e);

    logTestIO("updatePlanPreferences → 400 invalid reservePct", input, { error: err.message });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  deletePlan
// ════════════════════════════════════════════════════════════════════════════
describe("InvestmentPlanService.deletePlan", () => {

  it("removes the plan and its allocations from the store", async () => {
    const { service, planRepo } = buildSut();
    const plan = await service.createPlan({
      userId: USER_A, name: "To Delete", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });
    expect(planRepo.all()).toHaveLength(1);

    const input = { planId: plan.id, userId: USER_A };

    // ── ACT ───────────────────────────────────────────────────────────
    await service.deletePlan(input.planId, input.userId);

    logTestIO("deletePlan → removed", input, { plansRemaining: planRepo.all().length });

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // plan no longer exists in the repo
    expect(planRepo.all()).toHaveLength(0);
    const notFound = await service.getPlanById(plan.id, USER_A).catch((e) => e);
    expect(notFound).toBeInstanceOf(ApiError);
    expect(notFound.statusCode).toBe(404);
  });

  it("throws 404 when trying to delete a plan owned by someone else", async () => {
    const { service } = buildSut();
    const plan = await service.createPlan({
      userId: USER_A, name: "Plan", reservePct: 0.01, autoInvest: true, allocations: VALID_ALLOCATIONS,
    });

    const input = { planId: plan.id, userId: USER_B };
    const err   = await service.deletePlan(input.planId, input.userId).catch((e) => e);

    logTestIO("deletePlan → 404 wrong user", input, { error: err.message, statusCode: err.statusCode });

    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });
});
