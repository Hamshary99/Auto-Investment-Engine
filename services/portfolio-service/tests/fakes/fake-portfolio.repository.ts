import { randomUUID } from "crypto";
import { Portfolio } from "../../src/models/portfolio.model";
import { PortfolioRepository } from "../../src/repository/portfolio.repository";

export class FakePortfolioRepository extends PortfolioRepository {
  private byId = new Map<string, Portfolio>();
  private byUser = new Map<string, Portfolio>();

  async findByUserId(userId: string): Promise<Portfolio | null> {
    return this.byUser.get(userId) ?? null;
  }
  async findByUserIdWithHoldings(userId: string): Promise<Portfolio | null> {
    return this.byUser.get(userId) ?? null;
  }
  async findAllWithHoldings(): Promise<Portfolio[]> {
    return [...this.byId.values()];
  }
  async save(p: Portfolio): Promise<Portfolio> {
    this.byId.set(p.id, p);
    this.byUser.set(p.userId, p);
    return p;
  }
  async create(input: Partial<Portfolio>): Promise<Portfolio> {
    const p: Portfolio = {
      id: input.id ?? randomUUID(),
      userId: input.userId!,
      cashBalance: input.cashBalance ?? "0",
      holdings: input.holdings ?? [],
      createdAt: new Date(),
    };
    this.byId.set(p.id, p);
    this.byUser.set(p.userId, p);
    return p;
  }
}
