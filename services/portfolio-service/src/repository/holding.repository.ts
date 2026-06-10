import { EntityManager, Repository, IsNull } from "typeorm";
import { AppDataSource } from "../data-source";
import { Holding, UserPortfolio } from "../models/index";

export class HoldingRepository {
  private repo(tx?: EntityManager): Repository<Holding> {
    return tx ? tx.getRepository(Holding) : AppDataSource.getRepository(Holding);
  }

  findByUserPortfolioAndSymbol(
    userPortfolioId: string,
    symbol: string,
    planId: string | null = null,
    tx?: EntityManager,
  ): Promise<Holding | null> {
    return this.repo(tx).findOne({
      where: { userPortfolio: { id: userPortfolioId }, symbol, planId: planId ?? IsNull() },
      relations: { userPortfolio: true },
    });
  }

  findByPlanId(planId: string, tx?: EntityManager): Promise<Holding[]> {
    return this.repo(tx).find({ where: { planId } });
  }

  save(h: Holding, tx?: EntityManager): Promise<Holding> {
    return this.repo(tx).save(h);
  }

  create(
    input: { userPortfolio: UserPortfolio; symbol: string; quantity: string; avgCost: string; planId?: string | null },
    tx?: EntityManager,
  ): Holding {
    return this.repo(tx).create(input);
  }
}
