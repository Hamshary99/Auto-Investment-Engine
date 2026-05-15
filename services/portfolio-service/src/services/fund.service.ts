import {
  FundRepository,
  FundAllocationRepository,
  FundInvestmentRepository,
  PortfolioRepository,
} from "../repository/index";
import { Decimal } from "decimal.js";
import { Fund, Order } from "../models/index";
import { getStubPrice } from "./price.stub";
import { OrderService } from "./order.service";

export class FundService {
  constructor(
    private readonly funds: FundRepository,
    private readonly allocations: FundAllocationRepository,
    private readonly fundInvestments: FundInvestmentRepository,
    private readonly portfolios: PortfolioRepository,
    private readonly orderService: OrderService,
  ) {}

  listActiveFunds(): Promise<Fund[]> {
    return this.funds.findByActive();
  }

  async getActiveOrThrow(id: string): Promise<Fund> {
    const fund = await this.funds.findByIdActive(id, true);
    if (!fund) throw new Error("fund not found or inactive");
    return fund;
  }

  /**
   * Invest `amount` dollars from the user's portfolio into a fund.
   *
   *   1. Read Fund + its FundAllocations (the recipe).
   *   2. For each allocation: place a BUY Order via OrderService for
   *      (amount × targetWeight) / price worth of shares.
   *   3. Upsert the (portfolio, fund) row in fund_investments so we
   *      remember which funds this portfolio bought into.
   *
   * Order fills happen asynchronously on the bus — that's what later
   * mutates Holding and cashBalance. This method only records intent
   * (orders + fund_investments).
   */
  async invest(userId: string, fundId: string, amount: number): Promise<Order[]> {
    await this.getActiveOrThrow(fundId);

    const allocations = await this.allocations.findByFundId(fundId);
    if (!allocations.length) throw new Error("fund has no allocations");

    // Keep the 1-user-1-portfolio invariant for now: OrderService will
    // auto-create the portfolio on first order; we re-read it after so
    // we have a portfolioId for the fund_investments upsert.
    const total = new Decimal(amount);
    const orders: Order[] = [];

    for (const a of allocations) {
      const weight = new Decimal(a.targetWeight);
      const allocationAmount = total.mul(weight);
      const price = new Decimal(getStubPrice(a.symbol));
      const quantity = allocationAmount.div(price).toDecimalPlaces(6, Decimal.ROUND_DOWN);

      if (quantity.lte(0)) continue;

      const order = await this.orderService.placeOrder(userId, {
        symbol: a.symbol,
        side: "BUY",
        quantity: quantity.toNumber(),
      });
      orders.push(order);
    }

    // Record the portfolio→fund link. The portfolio exists by now
    // (OrderService.placeOrder seeded it on the first BUY).
    if (orders.length) {
      const portfolio = await this.portfolios.findByUserId(userId);
      if (portfolio) {
        await this.fundInvestments.addInvestment(portfolio.id, fundId, amount);
      }
    }

    return orders;
  }

  /**
   * Withdraw `amount` dollars from the user's commitment to a fund.
   *
   *   1. Read Fund + FundAllocations (same recipe).
   *   2. For each allocation: place a SELL Order for
   *      (amount × targetWeight) / price worth of shares.
   *   3. Update fund_investments: withdrawnAmount += amount.
   *
   * Notes / caveats:
   *  - Net committed dollars = investedAmount − withdrawnAmount. This is a
   *    *flow* record, NOT realized P&L. Per-fund P&L would require lot
   *    tracking, which we deliberately don't have.
   *  - We don't validate share availability up-front; OrderService rejects
   *    a SELL that exceeds the portfolio's holding for that symbol. Partial
   *    failure is possible (some symbols sell, others don't) — withdrawnAmount
   *    is updated optimistically based on what was *requested*.
   */
  async withdraw(userId: string, fundId: string, amount: number): Promise<Order[]> {
    await this.getActiveOrThrow(fundId);

    const allocations = await this.allocations.findByFundId(fundId);
    if (!allocations.length) throw new Error("fund has no allocations");

    const portfolio = await this.portfolios.findByUserId(userId);
    if (!portfolio) throw new Error("portfolio not found");

    const existing = await this.fundInvestments.findByPortfolioAndFund(
      portfolio.id,
      fundId,
    );
    if (!existing) {
      throw new Error("you have no investment in this fund to withdraw from");
    }

    const total = new Decimal(amount);
    const orders: Order[] = [];

    for (const a of allocations) {
      const weight = new Decimal(a.targetWeight);
      const allocationAmount = total.mul(weight);
      const price = new Decimal(getStubPrice(a.symbol));
      const quantity = allocationAmount.div(price).toDecimalPlaces(6, Decimal.ROUND_DOWN);

      if (quantity.lte(0)) continue;

      const order = await this.orderService.placeOrder(userId, {
        symbol: a.symbol,
        side: "SELL",
        quantity: quantity.toNumber(),
      });
      orders.push(order);
    }

    if (orders.length) {
      await this.fundInvestments.addWithdrawal(portfolio.id, fundId, amount);
    }

    return orders;
  }
}
