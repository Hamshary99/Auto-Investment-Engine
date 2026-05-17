import { randomUUID } from "crypto";
import { UserPortfolio } from "../../src/models/user-portfolio.model";
import { UserPortfolioRepository } from "../../src/repository/user-portfolio.repository";

export class FakeUserPortfolioRepository extends UserPortfolioRepository {
  private byId = new Map<string, UserPortfolio>();
  private byUser = new Map<string, UserPortfolio>();

  async findByUserId(userId: string): Promise<UserPortfolio | null> {
    return this.byUser.get(userId) ?? null;
  }
  async findByUserIdWithHoldings(userId: string): Promise<UserPortfolio | null> {
    return this.byUser.get(userId) ?? null;
  }
  async findAllWithHoldings(): Promise<UserPortfolio[]> {
    return [...this.byId.values()];
  }
  async save(p: UserPortfolio): Promise<UserPortfolio> {
    this.byId.set(p.id, p);
    this.byUser.set(p.userId, p);
    return p;
  }
  async create(input: Partial<UserPortfolio>): Promise<UserPortfolio> {
    const p: UserPortfolio = {
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
