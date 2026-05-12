import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { Portfolio } from "../models/portfolio.model";

export class PortfolioRepository {
  private repo(tx?: EntityManager): Repository<Portfolio> {
    return tx ? tx.getRepository(Portfolio) : AppDataSource.getRepository(Portfolio);
  }

  findByUserId(userId: string, tx?: EntityManager): Promise<Portfolio | null> {
    return this.repo(tx).findOne({ where: { userId } });
  }

  findByUserIdWithHoldings(userId: string, tx?: EntityManager): Promise<Portfolio | null> {
    return this.repo(tx).findOne({ where: { userId }, relations: { holdings: true } });
  }

  findAllWithHoldings(tx?: EntityManager): Promise<Portfolio[]> {
    return this.repo(tx).find({ relations: { holdings: true } });
  }

  save(p: Portfolio, tx?: EntityManager): Promise<Portfolio> {
    return this.repo(tx).save(p);
  }

  create(input: Partial<Portfolio>, tx?: EntityManager): Promise<Portfolio> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }
}
