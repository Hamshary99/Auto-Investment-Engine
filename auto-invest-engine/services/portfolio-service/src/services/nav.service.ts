import { Holding } from "../entities/Holding";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import { NavSnapshotRepository } from "../repositories/nav-snapshot.repository";
import { cash, d } from "../money";

/**
 * Daily NAV = cash + sum(holding.qty * markPrice). In a real system markPrice
 * comes from a market-data service; here we mock it as avgCost * 1.0 for demo.
 */
export class NavService {
  constructor(
    private readonly portfolios: PortfolioRepository,
    private readonly snapshots: NavSnapshotRepository
  ) {}

  async snapshotAll(forDate: string): Promise<number> {
    const portfolios = await this.portfolios.findAllWithHoldings();
    for (const p of portfolios) {
      const nav = p.holdings.reduce(
        (s, h) => s.plus(d(h.quantity).times(markPrice(h))),
        d(p.cashBalance)
      );
      await this.snapshots.insertIgnoreOnConflict({
        portfolioId: p.id,
        forDate,
        navValue: cash(nav),
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
