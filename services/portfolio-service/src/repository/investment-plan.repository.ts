import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { AutoInvestPlan, AutoInvestAllocation } from "../models/index";

export class AutoInvestPlanRepository {
  private planRepo(tx?: EntityManager): Repository<AutoInvestPlan> {
    return tx
      ? tx.getRepository(AutoInvestPlan)
      : AppDataSource.getRepository(AutoInvestPlan);
  }

  private allocationRepo(tx?: EntityManager): Repository<AutoInvestAllocation> {
    return tx
      ? tx.getRepository(AutoInvestAllocation)
      : AppDataSource.getRepository(AutoInvestAllocation);
  }

  listByUserId(userId: string, tx?: EntityManager): Promise<AutoInvestPlan[]> {
    return this.planRepo(tx).find({
      where: { userId },
      relations: { allocations: { productType: true } },
      order: { createdAt: "ASC" },
    });
  }

  findById(planId: string, tx?: EntityManager): Promise<AutoInvestPlan | null> {
    return this.planRepo(tx).findOne({
      where: { id: planId },
      relations: { allocations: { productType: true } },
    });
  }

  findAutoInvestEnabled(tx?: EntityManager): Promise<AutoInvestPlan[]> {
    return this.planRepo(tx).find({
      where: { autoInvest: true },
      relations: { allocations: { productType: true } },
    });
  }

  save(plan: AutoInvestPlan, tx?: EntityManager): Promise<AutoInvestPlan> {
    return this.planRepo(tx).save(plan);
  }

  create(
    input: Partial<AutoInvestPlan>,
    tx?: EntityManager,
  ): Promise<AutoInvestPlan> {
    const r = this.planRepo(tx);
    return r.save(r.create(input));
  }

  createAllocations(
    rows: Partial<AutoInvestAllocation>[],
    tx?: EntityManager,
  ): Promise<AutoInvestAllocation[]> {
    const r = this.allocationRepo(tx);
    return r.save(r.create(rows));
  }

  deleteAllocationsByPlanId(
    planId: string,
    tx?: EntityManager,
  ): Promise<void> {
    return this.allocationRepo(tx)
      .delete({ plan: { id: planId } })
      .then(() => undefined);
  }

  deletePlanById(planId: string, tx?: EntityManager): Promise<void> {
    return this.planRepo(tx)
      .delete({ id: planId })
      .then(() => undefined);
  }
}
