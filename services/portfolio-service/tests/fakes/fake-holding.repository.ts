import { randomUUID } from "crypto";
import { Holding } from "../../src/models/holding.model";
import { Portfolio } from "../../src/models/portfolio.model";
import { HoldingRepository } from "../../src/repository/holding.repository";

export class FakeHoldingRepository extends HoldingRepository {
  private byKey = new Map<string, Holding>();

  private k(portfolioId: string, symbol: string) { return `${portfolioId}:${symbol}`; }

  async findByPortfolioAndSymbol(portfolioId: string, symbol: string): Promise<Holding | null> {
    return this.byKey.get(this.k(portfolioId, symbol)) ?? null;
  }

  async save(h: Holding): Promise<Holding> {
    this.byKey.set(this.k(h.portfolio.id, h.symbol), h);
    return h;
  }

  create(input: { portfolio: Portfolio; symbol: string; quantity: string; avgCost: string }): Holding {
    return {
      id: randomUUID(),
      portfolio: input.portfolio,
      symbol: input.symbol,
      quantity: input.quantity,
      avgCost: input.avgCost,
      updatedAt: new Date(),
    };
  }

  get(portfolioId: string, symbol: string): Holding | undefined {
    return this.byKey.get(this.k(portfolioId, symbol));
  }
}
