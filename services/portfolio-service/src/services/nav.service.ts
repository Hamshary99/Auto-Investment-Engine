import { Holding } from "../models/index";
import { UserPortfolioRepository, NavSnapshotRepository } from "../repository/index";
import { cash, d } from "../utils/money";

export class NavService {
  constructor(
    private readonly userPortfolios: UserPortfolioRepository,
    private readonly snapshots: NavSnapshotRepository,
  ) {}

  async snapshotAll(forDate: string): Promise<number> {
    const userPortfolios = await this.userPortfolios.findAllWithHoldings();
    for (const p of userPortfolios) {
      const navValue = p.holdings.reduce(
        (sum, h) => sum.plus(d(h.quantity).times(markPrice(h))),
        d(p.cashBalance),
      );
      await this.snapshots.insertIgnoreOnConflict({
        userPortfolioId: p.id,
        forDate,
        navValue: cash(navValue),
      });
    }
    return userPortfolios.length;
  }

  async latestForUser(userId: string) {
    const p = await this.userPortfolios.findByUserId(userId);
    if (!p) return null;
    return this.snapshots.latestForUserPortfolio(p.id);
  }
}

function markPrice(h: Holding): string {
  return h.avgCost;
}
