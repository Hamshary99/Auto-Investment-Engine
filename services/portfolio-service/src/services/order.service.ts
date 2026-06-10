import { EntityManager } from "typeorm";
import { v4 as uuid } from "uuid";
import { AppDataSource } from "../data-source";
import {
  Order,
  OrderSide,
  OrderStatus,
  UserPortfolio,
  AutoInvestPlan
} from "../models/index";
import {
  UserPortfolioRepository,
  OrderRepository,
  HoldingRepository,
  AutoInvestPlanRepository,
 } from "../repository/index";
import { ApiError } from "../utils/error.handler";
import {
  addCash,
  addShares,
  cost,
  d,
  shares,
  subCash,
  weightedAvgCost,
} from "../utils/money";
import { Publisher, ROUTING_KEYS } from "@auto-invest/shared";

const DEMO_SEED_CASH = "100000.00";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly userPortfolios: UserPortfolioRepository,
    private readonly holdings: HoldingRepository,
    private readonly publisher: Publisher,
    private readonly plans: AutoInvestPlanRepository,
  ) {}

  async placeOrder(
    userId: string,
    input: { symbol: string; side: OrderSide; quantity: number; planId?: string },
  ) {
    const order = await AppDataSource.transaction(async (tx) => {
      await this.ensureUserPortfolio(tx, userId);
      return this.orders.create(
        {
          userId,
          symbol: input.symbol.toUpperCase(),
          side: input.side,
          quantity: String(input.quantity),
          planId: input.planId,
          status: OrderStatus.PENDING,
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

  async listOrdersForUser(userId: string) {
    return this.orders.findByUserId(userId);
  }

  async executeOrderTx(
    tx: EntityManager,
    orderId: string,
    fillPrice: number,
  ): Promise<void> {
    const order = await this.orders.findById(orderId, tx);
    if (!order)
      throw new ApiError(`order ${orderId} missing`, 404, "not_found");
    if (order.status !== OrderStatus.PENDING) return;

    try {
      let userPortfolio = await tx.getRepository(UserPortfolio).findOne({
        where: { userId: order.userId },
        lock: { mode: "pessimistic_write" },
      });
      if (!userPortfolio) {
        userPortfolio = await this.ensureUserPortfolio(tx, order.userId);
        // Lock it after creation
        userPortfolio = (await tx.getRepository(UserPortfolio).findOne({
          where: { userId: order.userId },
          lock: { mode: "pessimistic_write" },
        }))!;
      }

      let plan = null;
      if (order.planId) {
        plan = await tx.getRepository(AutoInvestPlan).findOne({
          where: { id: order.planId },
          lock: { mode: "pessimistic_write" },
        });
        if (!plan) throw new Error("Plan missing during settlement");
      }

      if (order.side === OrderSide.BUY) {
        await this.settleBuy(
          tx,
          userPortfolio,
          plan,
          order.planId || null,
          order.symbol,
          order.quantity,
          fillPrice,
        );
      } else {
        await this.settleSell(
          tx,
          userPortfolio,
          plan,
          order.planId || null,
          order.symbol,
          order.quantity,
          fillPrice,
        );
      }

      await this.markExecuted(tx, order, fillPrice);
    } catch (err: any) {
      // We must not use `tx` to mark failed, because `tx` might be aborted by Postgres 
      // (e.g. if subCash threw an error). We use the main repository connection instead.
      await this.markFailed(AppDataSource.manager, order, err.message ?? "unknown");
      throw err;
    }
  }

  private async settleBuy(
    tx: EntityManager,
    userPortfolio: UserPortfolio,
    plan: any,
    planId: string | null,
    symbol: string,
    qty: string,
    price: number,
  ) {
    await this.applyHoldingDelta(tx, userPortfolio, planId, symbol, qty, price);
    const fillCost = cost(qty, price);
    if (plan) {
      plan.cashBalance = subCash(plan.cashBalance, fillCost);
      if (d(plan.cashBalance).isNegative()) {
        const deficit = d(plan.cashBalance).abs();
        if (deficit.gt(0.05)) {
          throw new ApiError("Insufficient funds to execute order due to price surge", 400);
        }
        plan.cashBalance = "0.00";
      }
      plan.investedAmount = addCash(plan.investedAmount || "0", fillCost);
      await this.plans.save(plan, tx);
    } else {
      userPortfolio.cashBalance = subCash(userPortfolio.cashBalance, fillCost);
      if (d(userPortfolio.cashBalance).isNegative()) {
        userPortfolio.cashBalance = "0.00";
      }
      await this.userPortfolios.save(userPortfolio, tx);
    }
  }

  private async settleSell(
    tx: EntityManager,
    userPortfolio: UserPortfolio,
    plan: any,
    planId: string | null,
    symbol: string,
    qty: string,
    price: number,
  ) {
    let costBasisReduction = "0";
    if (plan) {
      const existing = await this.holdings.findByUserPortfolioAndSymbol(
        userPortfolio.id,
        symbol,
        planId,
        tx,
      );
      if (existing) {
        costBasisReduction = cost(qty, existing.avgCost);
      }
    }

    await this.applyHoldingDelta(
      tx,
      userPortfolio,
      planId,
      symbol,
      d(qty).negated().toString(),
      price,
    );
    const fillCost = cost(qty, price);
    // All SELL proceeds return to the global user cash wallet for simplicity
    userPortfolio.cashBalance = addCash(userPortfolio.cashBalance, fillCost);
    await this.userPortfolios.save(userPortfolio, tx);

    if (plan) {
      plan.investedAmount = subCash(plan.investedAmount || "0", costBasisReduction);
      // Ensure we don't drop below 0 due to precision errors
      if (d(plan.investedAmount).isNegative()) {
        plan.investedAmount = "0.00";
      }
      await this.plans.save(plan, tx);
    }
  }

  private async applyHoldingDelta(
    tx: EntityManager,
    userPortfolio: UserPortfolio,
    planId: string | null,
    symbol: string,
    qtyDelta: string,
    price: number,
    retryCount = 0,
  ): Promise<void> {
    const existing = await this.holdings.findByUserPortfolioAndSymbol(
      userPortfolio.id,
      symbol,
      planId,
      tx,
    );

    if (!existing) {
      if (d(qtyDelta).isNegative()) {
        throw new ApiError(
          `cannot sell ${symbol}: no position to sell into (oversell)`,
          400,
          "validation_error",
        );
      }
      const fresh = this.holdings.create(
        { userPortfolio, symbol, quantity: qtyDelta, avgCost: String(price), planId },
        tx,
      );
      try {
        await this.holdings.save(fresh, tx);
        return;
      } catch (err: any) {
        // 23505 is PostgreSQL unique constraint violation
        if (err.code === "23505" && retryCount < 2) {
          // Another transaction inserted the holding just now. 
          // Retry the delta application so it updates the new row instead.
          return this.applyHoldingDelta(tx, userPortfolio, planId, symbol, qtyDelta, price, retryCount + 1);
        }
        throw err;
      }
    }

    const newQty = addShares(existing.quantity, qtyDelta);
    if (d(newQty).isNegative())
      throw new ApiError(`oversell on ${symbol}`, 400, "validation_error");

    if (d(qtyDelta).isPositive()) {
      existing.avgCost = weightedAvgCost(
        existing.quantity,
        existing.avgCost,
        qtyDelta,
        price,
      );
    }
    existing.quantity = shares(newQty);
    await this.holdings.save(existing, tx);
  }

  private async markExecuted(
    tx: EntityManager,
    order: Order,
    fillPrice: number,
  ) {
    order.status = OrderStatus.EXECUTED;
    order.executedPrice = String(fillPrice);
    await this.orders.save(order, tx);
  }

  private async markFailed(tx: EntityManager, order: Order, reason: string) {
    order.status = OrderStatus.FAILED;
    order.failureReason = reason.slice(0, 500);
    await this.orders.save(order, tx);
  }

  private async ensureUserPortfolio(
    tx: EntityManager,
    userId: string,
  ): Promise<UserPortfolio> {
    const existing = await this.userPortfolios.findByUserId(userId, tx);
    if (existing) return existing;
    return this.userPortfolios.create(
      { userId, cashBalance: DEMO_SEED_CASH },
      tx,
    );
  }
}
