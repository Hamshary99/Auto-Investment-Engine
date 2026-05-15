import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { FundInvestment } from "../models/index";
import { Decimal } from "decimal.js";

export class FundInvestmentRepository {
  private repo(tx?: EntityManager): Repository<FundInvestment> {
    return tx ? tx.getRepository(FundInvestment) : AppDataSource.getRepository(FundInvestment);
  }

  findByPortfolioAndFund(
    portfolioId: string,
    fundId: string,
    tx?: EntityManager,
  ): Promise<FundInvestment | null> {
    return this.repo(tx).findOne({
      where: { portfolio: { id: portfolioId }, fund: { id: fundId } },
      relations: ["portfolio", "fund"],
    });
  }

  findByPortfolioId(portfolioId: string, tx?: EntityManager): Promise<FundInvestment[]> {
    return this.repo(tx).find({
      where: { portfolio: { id: portfolioId } },
      relations: ["fund"],
    });
  }

  /**
   * Upsert: add `amount` to the (portfolio, fund) row, creating it if missing.
   * Returns the resulting row.
   */
  async addInvestment(
    portfolioId: string,
    fundId: string,
    amount: number,
    tx?: EntityManager,
  ): Promise<FundInvestment> {
    const r = this.repo(tx);
    const existing = await this.findByPortfolioAndFund(portfolioId, fundId, tx);
    if (existing) {
      const next = new Decimal(existing.investedAmount).plus(amount).toFixed(2);
      existing.investedAmount = next;
      return r.save(existing);
    }
    const row = r.create({
      portfolio: { id: portfolioId } as any,
      fund: { id: fundId } as any,
      investedAmount: new Decimal(amount).toFixed(2),
      withdrawnAmount: "0.00",
    });
    return r.save(row);
  }

  /**
   * Upsert: add `amount` to the withdrawnAmount on the (portfolio, fund) row.
   * Throws if no investment row exists — you can't withdraw from a fund you
   * never invested in.
   */
  async addWithdrawal(
    portfolioId: string,
    fundId: string,
    amount: number,
    tx?: EntityManager,
  ): Promise<FundInvestment> {
    const r = this.repo(tx);
    const existing = await this.findByPortfolioAndFund(portfolioId, fundId, tx);
    if (!existing) {
      throw new Error("no fund_investment row exists for this (portfolio, fund)");
    }
    existing.withdrawnAmount = new Decimal(existing.withdrawnAmount)
      .plus(amount)
      .toFixed(2);
    return r.save(existing);
  }
}
