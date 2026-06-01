import { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source";
import { AutoInvestPlan, AutoInvestAllocation, ProductType } from "../models/index";
import { RiskProfile } from "../models/types";
import { ApiError } from "../utils/error.handler";
import { AutoInvestPlanRepository } from "../repository/index";
import { ProductTypeRepository, RiskProfileTemplateRepository } from "@auto-invest/shared";

type AllocationInput = { productTypeId: string; weight: number };

const WEIGHT_SUM_TOLERANCE = 0.0001;

export class InvestmentPlanService {
  constructor(
    private planRepo: AutoInvestPlanRepository,
    private productTypeRepo: ProductTypeRepository,
    private riskTemplateRepo: RiskProfileTemplateRepository,
  ) {}

  listPlansByUserId(userId: string): Promise<AutoInvestPlan[]> {
    return this.planRepo.listByUserId(userId);
  }

  async getPlanById(planId: string, userId: string): Promise<AutoInvestPlan> {
    const plan = await this.planRepo.findById(planId);
    if (!plan || plan.userId !== userId) {
      throw new ApiError("Investment plan not found", 404, "not_found");
    }
    return plan;
  }

  listAutoInvestEnabledPlans(): Promise<AutoInvestPlan[]> {
    return this.planRepo.findAutoInvestEnabled();
  }

  async createPlan(input: {
    userId: string;
    name: string;
    riskProfile?: RiskProfile;
    reservePct: number;
    autoInvest: boolean;
    allocations: AllocationInput[];
  }): Promise<AutoInvestPlan> {
    const name = this.validateName(input.name);
    this.validateReservePct(input.reservePct);
    const allocations = this.validateAllocations(input.allocations);

    return AppDataSource.transaction(async (tx) => {
      await this.assertProductTypesActive(allocations, tx);

      const plan = await this.planRepo.create(
        {
          userId: input.userId,
          name,
          riskProfile: input.riskProfile,
          reservePct: input.reservePct,
          autoInvest: input.autoInvest,
        },
        tx,
      );

      await this.planRepo.createAllocations(
        this.buildAllocationRows(plan.id, allocations),
        tx,
      );

      return this.requirePlan(plan.id, tx);
    });
  }

  async createPlanFromRiskProfile(input: {
    userId: string;
    riskProfile: RiskProfile;
    reservePct?: number;
    autoInvest?: boolean;
  }): Promise<AutoInvestPlan> {
    return AppDataSource.transaction(async (tx) => {
      const templateRows = await this.riskTemplateRepo.findByRiskProfile(
        input.riskProfile,
        tx as any,
      );
      if (templateRows.length === 0) {
        throw new ApiError(
          `No risk profile template configured for ${input.riskProfile}`,
          400,
          "invalid_input",
        );
      }

      const allocations = this.validateAllocations(
        templateRows.map((r) => ({
          productTypeId: r.productType.id,
          weight: Number(r.weight),
        })),
      );
      await this.assertProductTypesActive(allocations, tx);

      const plan = await this.planRepo.create(
        {
          userId: input.userId,
          name: this.autoGeneratePlanName(input.riskProfile),
          riskProfile: input.riskProfile,
          reservePct: input.reservePct ?? 0.01,
          autoInvest: input.autoInvest ?? true,
        },
        tx,
      );

      await this.planRepo.createAllocations(
        this.buildAllocationRows(plan.id, allocations),
        tx,
      );

      return this.requirePlan(plan.id, tx);
    });
  }

  private autoGeneratePlanName(riskProfile: RiskProfile): string {
    const label = riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1);
    const stamp = new Date().toISOString().slice(0, 10);
    return `${label} plan – ${stamp}`;
  }

  async updatePlanAllocations(input: {
    planId: string;
    userId: string;
    riskProfile: RiskProfile;
    allocations: AllocationInput[];
  }): Promise<AutoInvestPlan> {
    const allocations = this.validateAllocations(input.allocations);

    return AppDataSource.transaction(async (tx) => {
      const plan = await this.loadOwnedPlan(input.planId, input.userId, tx);
      await this.assertProductTypesActive(allocations, tx);

      plan.riskProfile = input.riskProfile;
      await this.planRepo.save(plan, tx);

      await this.planRepo.deleteAllocationsByPlanId(plan.id, tx);
      await this.planRepo.createAllocations(
        this.buildAllocationRows(plan.id, allocations),
        tx,
      );

      return this.requirePlan(plan.id, tx);
    });
  }

  async updatePlanPreferences(input: {
    planId: string;
    userId: string;
    name?: string;
    reservePct?: number;
    autoInvest?: boolean;
  }): Promise<AutoInvestPlan> {
    return AppDataSource.transaction(async (tx) => {
      const plan = await this.loadOwnedPlan(input.planId, input.userId, tx);

      if (input.name !== undefined) plan.name = this.validateName(input.name);
      if (input.reservePct !== undefined) {
        this.validateReservePct(input.reservePct);
        plan.reservePct = input.reservePct;
      }
      if (input.autoInvest !== undefined) plan.autoInvest = input.autoInvest;

      await this.planRepo.save(plan, tx);
      return this.requirePlan(plan.id, tx);
    });
  }

  // TODO: implement method to trigger manual allocation based on current plan and portfolio state
  // async manualAllocate(
  //   planId: string,
  //   userId: string,
  //   allocations: AllocationInput[],
  //   tx?: EntityManager,
  // ): Promise<void> {
    
  // }

  async deletePlan(planId: string, userId: string): Promise<void> {
    await AppDataSource.transaction(async (tx) => {
      const plan = await this.loadOwnedPlan(planId, userId, tx);
      await this.planRepo.deleteAllocationsByPlanId(plan.id, tx);
      await this.planRepo.deletePlanById(plan.id, tx);
    });
  }

  // --- internals ---

  private async loadOwnedPlan(
    planId: string,
    userId: string,
    tx: EntityManager,
  ): Promise<AutoInvestPlan> {
    const plan = await this.planRepo.findById(planId, tx);
    if (!plan || plan.userId !== userId) {
      throw new ApiError("Investment plan not found", 404, "not_found");
    }
    return plan;
  }

  private async requirePlan(
    planId: string,
    tx: EntityManager,
  ): Promise<AutoInvestPlan> {
    const plan = await this.planRepo.findById(planId, tx);
    if (!plan) {
      throw new ApiError("Investment plan not found", 404, "not_found");
    }
    return plan;
  }

  private validateName(raw: string): string {
    const name = (raw ?? "").trim();
    if (name.length === 0) {
      throw new ApiError("Plan name is required", 400, "invalid_input");
    }
    if (name.length > 80) {
      throw new ApiError("Plan name too long (max 80)", 400, "invalid_input");
    }
    return name;
  }

  private validateReservePct(pct: number): void {
    if (!Number.isFinite(pct) || pct < 0 || pct > 1) {
      throw new ApiError(
        "reservePct must be between 0 and 1",
        400,
        "invalid_input",
      );
    }
  }

  private validateAllocations(rows: AllocationInput[]): AllocationInput[] {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ApiError(
        "At least one allocation is required",
        400,
        "invalid_input",
      );
    }

    const seen = new Set<string>();
    let sum = 0;
    for (const r of rows) {
      if (!r.productTypeId) {
        throw new ApiError("productTypeId is required", 400, "invalid_input");
      }
      if (seen.has(r.productTypeId)) {
        throw new ApiError(
          `Duplicate allocation for productTypeId ${r.productTypeId}`,
          400,
          "invalid_input",
        );
      }
      seen.add(r.productTypeId);

      if (!Number.isFinite(r.weight) || r.weight <= 0 || r.weight > 1) {
        throw new ApiError(
          "Each allocation weight must be in (0, 1]",
          400,
          "invalid_input",
        );
      }
      sum += r.weight;
    }

    if (Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
      throw new ApiError(
        `Allocation weights must sum to 1.0 (got ${sum.toFixed(4)})`,
        400,
        "invalid_input",
      );
    }

    return rows;
  }

  private async assertProductTypesActive(
    allocations: AllocationInput[],
    tx: EntityManager,
  ): Promise<void> {
    const ids = allocations.map((a) => a.productTypeId);
    const found = await this.productTypeRepo.findActiveByIds(ids, tx as any);
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new ApiError(
        `Unknown or inactive product types: ${missing.join(", ")}`,
        400,
        "invalid_input",
      );
    }
  }

  private buildAllocationRows(
    planId: string,
    allocations: AllocationInput[],
  ): Partial<AutoInvestAllocation>[] {
    return allocations.map((a) => ({
      plan: { id: planId } as AutoInvestPlan,
      productType: { id: a.productTypeId } as ProductType,
      weight: a.weight,
    }));
  }
}
