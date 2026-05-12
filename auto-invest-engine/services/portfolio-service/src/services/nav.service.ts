import { Holding } from "../entities/Holding";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import { NavSnapshotRepository } from "../repositories/nav-snapshot.repository";

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
      const nav = Number(p.cashBalance) + p.holdings.reduce((s, h) => s + Number(h.quantity) * markPrice(h), 0);
      await this.snapshots.insertIgnoreOnConflict({
        portfolioId: p.id,
        forDate,
        navValue: nav.toFixed(2),
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

function markPrice(h: Holding): number {
  // demo stub
  return Number(h.avgCost);
}
