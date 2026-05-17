import { EntityManager } from "typeorm";
import { v4 as uuid } from "uuid";
import { AppDataSource } from "../data-source";
import { Order, UserPortfolio } from "../models/index";
import { OrderSide } from "../models/order.model";
import { OrderRepository } from "../repository/order.repository";
import { UserPortfolioRepository } from "../repository/user-portfolio.repository";
import { HoldingRepository } from "../repository/holding.repository";
import { ApiError } from "../utils/error.handler";
import { addCash, addShares, cost, d, shares, subCash, weightedAvgCost } from "../utils/money";
import { Publisher, ROUTING_KEYS } from "@auto-invest/shared";

const DEMO_SEED_CASH = "100000.00";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly userPortfolios: UserPortfolioRepository,
    private readonly holdings: HoldingRepository,
    private readonly publisher: Publisher,
  ) {}

  async placeOrder(userId: string, input: { symbol: string; side: OrderSide; quantity: number }) {
    const order = await AppDataSource.transaction(async (tx) => {
      await this.ensureUserPortfolio(tx, userId);
      return this.orders.create(
        {
          userId,
          symbol: input.symbol.toUpperCase(),
          side: input.side,
          quantity: String(input.quantity),
          status: "PENDING",
        },
        tx,
      );
    });

    await this.publisher.publish(
      ROUTING_KEYS.ORDER_CREATED,
      {
        orderId: order.id,
        userId,
        symbol: order.symbol,
        side: order.side,
        quantity: Number(order.quantity),
      },
      uuid(),
    );

    return order;
  }

  async findOrderForUser(userId: string, id: string) {
    const o = await this.orders.findByIdForUser(id, userId);
    if (!o) throw new ApiError("order not found", 404, "not_found");
    return o;
  }

  async executeOrderTx(tx: EntityManager, orderId: string, fillPrice: number): Promise<void> {
    const order = await this.orders.findById(orderId, tx);
    if (!order) throw new ApiError(`order ${orderId} missing`, 404, "not_found");
    if (order.status !== "PENDING") return;

    try {
      const userPortfolio = await this.ensureUserPortfolio(tx, order.userId);

      if (order.side === "BUY") {
        await this.settleBuy(tx, userPortfolio, order.symbol, order.quantity, fillPrice);
      } else {
        await this.settleSell(tx, userPortfolio, order.symbol, order.quantity, fillPrice);
      }

      await this.markExecuted(tx, order, fillPrice);
    } catch (err: any) {
      await this.markFailed(tx, order, err.message ?? "unknown");
      throw err;
    }
  }

  private async settleBuy(
    tx: EntityManager,
    userPortfolio: UserPortfolio,
    symbol: string,
    qty: string,
    price: number,
  ) {
    await this.applyHoldingDelta(tx, userPortfolio, symbol, qty, price);
    userPortfolio.cashBalance = subCash(userPortfolio.cashBalance, cost(qty, price));
    await this.userPortfolios.save(userPortfolio, tx);
  }

  private async settleSell(
    tx: EntityManager,
    userPortfolio: UserPortfolio,
    symbol: string,
    qty: string,
    price: number,
  ) {
    await this.applyHoldingDelta(tx, userPortfolio, symbol, d(qty).negated().toString(), price);
    userPortfolio.cashBalance = addCash(userPortfolio.cashBalance, cost(qty, price));
    await this.userPortfolios.save(userPortfolio, tx);
  }

  private async applyHoldingDelta(
    tx: EntityManager,
    userPortfolio: UserPortfolio,
    symbol: string,
    qtyDelta: string,
    price: number,
  ) {
    const existing = await this.holdings.findByUserPortfolioAndSymbol(userPortfolio.id, symbol, tx);

    if (!existing) {
      if (d(qtyDelta).isNegative()) {
        throw new ApiError(`cannot sell ${symbol}: no position`, 400, "validation_error");
      }
      const fresh = this.holdings.create(
        { userPortfolio, symbol, quantity: qtyDelta, avgCost: String(price) },
        tx,
      );
      await this.holdings.save(fresh, tx);
      return;
    }

    const newQty = addShares(existing.quantity, qtyDelta);
    if (d(newQty).isNegative()) throw new ApiError(`oversell on ${symbol}`, 400, "validation_error");

    if (d(qtyDelta).isPositive()) {
      existing.avgCost = weightedAvgCost(existing.quantity, existing.avgCost, qtyDelta, price);
    }
    existing.quantity = shares(newQty);
    await this.holdings.save(existing, tx);
  }

  private async markExecuted(tx: EntityManager, order: Order, fillPrice: number) {
    order.status = "EXECUTED";
    order.executedPrice = String(fillPrice);
    await this.orders.save(order, tx);
  }

  private async markFailed(tx: EntityManager, order: Order, reason: string) {
    order.status = "FAILED";
    order.failureReason = reason.slice(0, 500);
    await this.orders.save(order, tx);
  }

  private async ensureUserPortfolio(tx: EntityManager, userId: string): Promise<UserPortfolio> {
    const existing = await this.userPortfolios.findByUserId(userId, tx);
    if (existing) return existing;
    return this.userPortfolios.create({ userId, cashBalance: DEMO_SEED_CASH }, tx);
  }
}
