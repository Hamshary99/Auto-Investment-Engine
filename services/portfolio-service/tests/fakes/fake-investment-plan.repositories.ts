import { randomUUID } from "crypto";
import {
  AutoInvestPlanRepository,
  ProductTypeRepository,
  RiskProfileTemplateRepository,
} from "../../src/repository/index";
import { AutoInvestPlan }       from "../../src/models/auto-invest-plan.model";
import { AutoInvestAllocation } from "../../src/models/auto-invest-allocation.model";
import { ProductType }           from "../../src/models/product-type.model";
import { RiskProfileTemplate }   from "../../src/models/risk-profile-template.model";
import { RiskProfile }           from "../../src/models/types";

// ─── FakeAutoInvestPlanRepository ────────────────────────────────────────────

export class FakeAutoInvestPlanRepository extends AutoInvestPlanRepository {
  private plans       = new Map<string, AutoInvestPlan>();
  private allocations = new Map<string, AutoInvestAllocation[]>(); // planId → rows

  async listByUserId(userId: string): Promise<AutoInvestPlan[]> {
    return [...this.plans.values()].filter((p) => p.userId === userId);
  }

  async findById(planId: string): Promise<AutoInvestPlan | null> {
    const plan = this.plans.get(planId) ?? null;
    if (!plan) return null;
    // attach live allocations so callers see the full graph
    plan.allocations = this.allocations.get(planId) ?? [];
    return plan;
  }

  async findAutoInvestEnabled(): Promise<AutoInvestPlan[]> {
    return [...this.plans.values()].filter((p) => p.autoInvest);
  }

  async save(plan: AutoInvestPlan): Promise<AutoInvestPlan> {
    this.plans.set(plan.id, plan);
    return plan;
  }

  async create(input: Partial<AutoInvestPlan>): Promise<AutoInvestPlan> {
    const plan: AutoInvestPlan = {
      id:          randomUUID(),
      userId:      input.userId!,
      name:        input.name!,
      riskProfile: input.riskProfile!,
      cashBalance: input.cashBalance ?? "0",
      reservePct:  input.reservePct ?? 0.01,
      autoInvest:  input.autoInvest ?? true,
      allocations: [],
      createdAt:   new Date(),
      updatedAt:   new Date(),
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  async createAllocations(rows: Partial<AutoInvestAllocation>[]): Promise<AutoInvestAllocation[]> {
    const created: AutoInvestAllocation[] = rows.map((r) => ({
      id:          randomUUID(),
      plan:        r.plan!,
      productType: r.productType!,
      weight:      r.weight!,
      createdAt:   new Date(),
      updatedAt:   new Date(),
    }));
    const planId = created[0]?.plan?.id;
    if (planId) this.allocations.set(planId, created);
    return created;
  }

  async deleteAllocationsByPlanId(planId: string): Promise<void> {
    this.allocations.delete(planId);
  }

  async deletePlanById(planId: string): Promise<void> {
    this.plans.delete(planId);
  }

  // inspection
  all(): AutoInvestPlan[] { return [...this.plans.values()]; }
}

// ─── FakeProductTypeRepository (investment-plan flavour) ─────────────────────

export class FakeProductTypeForPlanRepository extends ProductTypeRepository {
  private byId = new Map<string, ProductType>();

  seed(pt: Partial<ProductType> & { id: string }) {
    this.byId.set(pt.id, pt as ProductType);
  }

  async findActiveByIds(ids: string[]): Promise<ProductType[]> {
    return ids
      .map((id) => this.byId.get(id))
      .filter((pt): pt is ProductType => !!pt && (pt as ProductType).isActive);
  }
}

// ─── FakeRiskProfileTemplateRepository ───────────────────────────────────────

export class FakeRiskProfileTemplateRepository extends RiskProfileTemplateRepository {
  private rows: RiskProfileTemplate[] = [];

  seed(template: Partial<RiskProfileTemplate>) {
    this.rows.push(template as RiskProfileTemplate);
  }

  async findByRiskProfile(riskProfile: RiskProfile): Promise<RiskProfileTemplate[]> {
    return this.rows.filter((r) => r.riskProfile === riskProfile);
  }
}
