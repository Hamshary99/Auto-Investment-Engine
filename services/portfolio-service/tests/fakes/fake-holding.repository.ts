import { randomUUID } from "crypto";
import { Holding } from "../../src/models/holding.model";
import { UserPortfolio } from "../../src/models/user-portfolio.model";
import { HoldingRepository } from "../../src/repository/holding.repository";

export class FakeHoldingRepository extends HoldingRepository {
  private byKey = new Map<string, Holding>();

  private k(userPortfolioId: string, symbol: string) {
    return `${userPortfolioId}:${symbol}`;
  }

  async findByUserPortfolioAndSymbol(userPortfolioId: string, symbol: string): Promise<Holding | null> {
    return this.byKey.get(this.k(userPortfolioId, symbol)) ?? null;
  }

  async save(h: Holding): Promise<Holding> {
    this.byKey.set(this.k(h.userPortfolio.id, h.symbol), h);
    return h;
  }

  create(input: {
    userPortfolio: UserPortfolio;
    symbol: string;
    quantity: string;
    avgCost: string;
  }): Holding {
    return {
      id: randomUUID(),
      userPortfolio: input.userPortfolio,
      symbol: input.symbol,
      quantity: input.quantity,
      avgCost: input.avgCost,
      updatedAt: new Date(),
    };
  }

  get(userPortfolioId: string, symbol: string): Holding | undefined {
    return this.byKey.get(this.k(userPortfolioId, symbol));
  }
}
