import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { Holding, UserPortfolio } from "../models/index";

export class HoldingRepository {
  private repo(tx?: EntityManager): Repository<Holding> {
    return tx ? tx.getRepository(Holding) : AppDataSource.getRepository(Holding);
  }

  findByUserPortfolioAndSymbol(
    userPortfolioId: string,
    symbol: string,
    tx?: EntityManager,
  ): Promise<Holding | null> {
    return this.repo(tx).findOne({
      where: { userPortfolio: { id: userPortfolioId }, symbol },
      relations: { userPortfolio: true },
    });
  }

  save(h: Holding, tx?: EntityManager): Promise<Holding> {
    return this.repo(tx).save(h);
  }

  create(
    input: { userPortfolio: UserPortfolio; symbol: string; quantity: string; avgCost: string },
    tx?: EntityManager,
  ): Holding {
    return this.repo(tx).create(input);
  }
}
