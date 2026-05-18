import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { AutoInvestPlan } from "../models/auto-invest-plan.model";
import { AutoInvestAllocation } from "../models/auto-invest-allocation.model";

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

  findByUserId(
    userId: string,
    tx?: EntityManager,
  ): Promise<AutoInvestPlan | null> {
    return this.planRepo(tx).findOne({
      where: { userId },
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

  findAllocationsByPlanId(
    planId: string,
    tx?: EntityManager,
  ): Promise<AutoInvestAllocation[]> {
    return this.allocationRepo(tx).find({
      where: { plan: { id: planId } },
      relations: { productType: true },
      order: { productType: { name: "ASC" } },
    });
  }

  deleteAllocationsByPlanId(planId: string, tx: EntityManager): Promise<void> {
    const repo = this.allocationRepo(tx);
    return repo.delete({ plan: { id: planId } }).then(() => undefined);
  }

  createAllocation(
    input: Partial<AutoInvestAllocation>,
    tx?: EntityManager,
  ): Promise<AutoInvestAllocation> {
    const r = this.allocationRepo(tx);
    return r.save(r.create(input));
  }
}
