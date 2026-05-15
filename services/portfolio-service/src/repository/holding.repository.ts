import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { Holding } from "../models/index";
import { Portfolio } from "../models/index";

export class HoldingRepository {
  private repo(tx?: EntityManager): Repository<Holding> {
    return tx ? tx.getRepository(Holding) : AppDataSource.getRepository(Holding);
  }

  findByPortfolioAndSymbol(portfolioId: string, symbol: string, tx?: EntityManager): Promise<Holding | null> {
    return this.repo(tx).findOne({
      where: { portfolio: { id: portfolioId }, symbol },
      relations: { portfolio: true },
    });
  }

  save(h: Holding, tx?: EntityManager): Promise<Holding> {
    return this.repo(tx).save(h);
  }

  create(input: { portfolio: Portfolio; symbol: string; quantity: string; avgCost: string }, tx?: EntityManager): Holding {
    return this.repo(tx).create(input);
  }
}
