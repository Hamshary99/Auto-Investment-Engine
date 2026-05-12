import { Holding } from "../models/holding.model";
import { PortfolioRepository } from "../repository/portfolio.repository";
import { NavSnapshotRepository } from "../repository/nav-snapshot.repository";
import { cash, d } from "../utils/money";

/**
 * Daily NAV (Net Asset Value) = cash + Σ(holding.qty × markPrice).
 * In a real system markPrice comes from a market-data service;
 * here we stub it as the holding's average cost.
 */
export class NavService {
  constructor(
    private readonly portfolios: PortfolioRepository,
    private readonly snapshots: NavSnapshotRepository
  ) {}

  /** Compute and persist a NAV row per portfolio. Re-runs for the same date are no-ops. */
  async snapshotAll(forDate: string): Promise<number> {
    const portfolios = await this.portfolios.findAllWithHoldings();
    for (const p of portfolios) {
      const navValue = p.holdings.reduce(
        (sum, h) => sum.plus(d(h.quantity).times(markPrice(h))),
        d(p.cashBalance)
      );
      await this.snapshots.insertIgnoreOnConflict({
        portfolioId: p.id,
        forDate,
        navValue: cash(navValue),
      });
    }
    return portfolios.length;
  }

  async latestForUser(userId: string) {
    const p = await this.portfolios.findByUserId(userId);
    if (!p) return null;
    return this.snapshots.latestForPortfolio(p.id);
  }
}

function markPrice(h: Holding): string {
  // demo stub — real impl would fetch a live mark from a market-data service.
  return h.avgCost;
}
