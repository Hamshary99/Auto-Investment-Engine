import { EntityManager, Repository, IsNull } from "typeorm";
import { AppDataSource } from "../data-source";
import { SubscribedPortfolio } from "../models/index";
import { Decimal } from "decimal.js";

export class SubscribedPortfolioRepository {
  private repo(tx?: EntityManager): Repository<SubscribedPortfolio> {
    return tx ? tx.getRepository(SubscribedPortfolio) : AppDataSource.getRepository(SubscribedPortfolio);
  }

  findByUserPortfolioAndProductType(
    userPortfolioId: string,
    productTypeId: string,
    planId: string | null = null,
    tx?: EntityManager,
  ): Promise<SubscribedPortfolio | null> {
    return this.repo(tx).findOne({
      where: {
        userPortfolio: { id: userPortfolioId },
        productType: { id: productTypeId },
        planId: planId ?? IsNull(),
      },
      relations: ["userPortfolio", "productType"],
    });
  }

  findByUserPortfolioId(userPortfolioId: string, tx?: EntityManager): Promise<SubscribedPortfolio[]> {
    return this.repo(tx).find({
      where: { userPortfolio: { id: userPortfolioId } },
      relations: ["productType"],
    });
  }

  async recordAddFund(
    userPortfolioId: string,
    productTypeId: string,
    amount: number,
    planId: string | null = null,
    tx?: EntityManager,
  ): Promise<SubscribedPortfolio> {
    const r = this.repo(tx);
    const existing = await this.findByUserPortfolioAndProductType(userPortfolioId, productTypeId, planId, tx);
    if (existing) {
      existing.investedAmount = new Decimal(existing.investedAmount).plus(amount).toFixed(2);
      return r.save(existing);
    }
    const row = r.create({
      userPortfolio: { id: userPortfolioId } as any,
      productType: { id: productTypeId } as any,
      planId: planId,
      investedAmount: new Decimal(amount).toFixed(2),
      redeemedAmount: "0.00",
    });
    return r.save(row);
  }

  async recordRedemption(
    userPortfolioId: string,
    productTypeId: string,
    amount: number,
    planId: string | null = null,
    tx?: EntityManager,
  ): Promise<SubscribedPortfolio> {
    const r = this.repo(tx);
    const existing = await this.findByUserPortfolioAndProductType(userPortfolioId, productTypeId, planId, tx);
    if (!existing) {
      throw new Error("no subscribed_portfolio row for this (user_portfolio, product_type)");
    }
    existing.redeemedAmount = new Decimal(existing.redeemedAmount).plus(amount).toFixed(2);
    return r.save(existing);
  }
}
