import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { NavSnapshot } from "../entities/NavSnapshot";

export class NavSnapshotRepository {
  private repo(tx?: EntityManager): Repository<NavSnapshot> {
    return tx ? tx.getRepository(NavSnapshot) : AppDataSource.getRepository(NavSnapshot);
  }

  /**
   * INSERT ... ON CONFLICT DO NOTHING via TypeORM's orIgnore(). Replays of the
   * NAV snapshot job for the same (portfolioId, forDate) are safe no-ops.
   */
  insertIgnoreOnConflict(input: { portfolioId: string; forDate: string; navValue: string }, tx?: EntityManager) {
    return this.repo(tx)
      .createQueryBuilder()
      .insert()
      .values(input)
      .orIgnore()
      .execute();
  }

  latestForPortfolio(portfolioId: string, tx?: EntityManager): Promise<NavSnapshot | null> {
    return this.repo(tx).findOne({ where: { portfolioId }, order: { forDate: "DESC" } });
  }
}
