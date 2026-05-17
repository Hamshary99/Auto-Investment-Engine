import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { NavSnapshot } from "../models/nav-snapshot.model";

export class NavSnapshotRepository {
  private repo(tx?: EntityManager): Repository<NavSnapshot> {
    return tx ? tx.getRepository(NavSnapshot) : AppDataSource.getRepository(NavSnapshot);
  }

  insertIgnoreOnConflict(
    input: { userPortfolioId: string; forDate: string; navValue: string },
    tx?: EntityManager,
  ) {
    return this.repo(tx)
      .createQueryBuilder()
      .insert()
      .values(input)
      .orIgnore()
      .execute();
  }

  latestForUserPortfolio(userPortfolioId: string, tx?: EntityManager): Promise<NavSnapshot | null> {
    return this.repo(tx).findOne({
      where: { userPortfolioId },
      order: { forDate: "DESC" },
    });
  }
}
