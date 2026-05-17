import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { UserPortfolio } from "../models/user-portfolio.model";

export class UserPortfolioRepository {
  private repo(tx?: EntityManager): Repository<UserPortfolio> {
    return tx ? tx.getRepository(UserPortfolio) : AppDataSource.getRepository(UserPortfolio);
  }

  findByUserId(userId: string, tx?: EntityManager): Promise<UserPortfolio | null> {
    return this.repo(tx).findOne({ where: { userId } });
  }

  findByUserIdWithHoldings(userId: string, tx?: EntityManager): Promise<UserPortfolio | null> {
    return this.repo(tx).findOne({ where: { userId }, relations: { holdings: true } });
  }

  findAllWithHoldings(tx?: EntityManager): Promise<UserPortfolio[]> {
    return this.repo(tx).find({ relations: { holdings: true } });
  }

  save(p: UserPortfolio, tx?: EntityManager): Promise<UserPortfolio> {
    return this.repo(tx).save(p);
  }

  create(input: Partial<UserPortfolio>, tx?: EntityManager): Promise<UserPortfolio> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }
}
