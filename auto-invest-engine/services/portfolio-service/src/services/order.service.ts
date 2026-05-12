import { EntityManager } from "typeorm";
import { v4 as uuid } from "uuid";
import { AppDataSource } from "../data-source";
import { Order, OrderSide } from "../models/order.model";
import { Portfolio } from "../models/portfolio.model";
import { OrderRepository } from "../repository/order.repository";
import { PortfolioRepository } from "../repository/portfolio.repository";
import { HoldingRepository } from "../repository/holding.repository";
import { ApiError } from "../utils/error.handler";
import { addCash, addShares, cost, d, shares, subCash, weightedAvgCost } from "../utils/money";
import { Publisher, ROUTING_KEYS } from "@auto-invest/shared";

const DEMO_SEED_CASH = "100000.00";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly portfolios: PortfolioRepository,
    private readonly holdings: HoldingRepository,
    private readonly publisher: Publisher
  ) {}

  // ──────────────────────────────────────────────────────────────────
  //  PUBLIC API
  // ──────────────────────────────────────────────────────────────────

  /**
   * 1. Persist a PENDING order row.
   * 2. Publish `order.created` so the execution consumer can fill it.
   * Auto-seeds a portfolio for first-time users (demo convenience).
   */
  async placeOrder(userId: string, input: { symbol: string; side: OrderSide; quantity: number }) {
    const order = await AppDataSource.transaction(async (tx) => {
      await this.ensurePortfolio(tx, userId);
      return this.orders.create({
        userId,
        symbol: input.symbol.toUpperCase(),
        side: input.side,
        quantity: String(input.quantity),
        status: "PENDING",
      }, tx);
    });

    await this.publisher.publish(ROUTING_KEYS.ORDER_CREATED, {
      orderId: order.id,
      userId,
      symbol: order.symbol,
      side: order.side,
      quantity: Number(order.quantity),
    }, uuid());

    return order;
  }

  async findOrderForUser(userId: string, id: string) {
    const o = await this.orders.findByIdForUser(id, userId);
    if (!o) throw new ApiError("order not found", 404, "not_found");
    return o;
  }

  /**
   * State machine: PENDING → EXECUTED | FAILED.
   *
   *   BUY  →  holding qty ↑, avgCost weighted, cash ↓ by qty × fillPrice
   *   SELL →  holding qty ↓, avgCost unchanged, cash ↑ by qty × fillPrice
   *
   * Replay-safe: if the order is already terminal we no-op. Idempotency
   * of the message itself is enforced by the inbox table at the consumer
   * layer; this is the second line of defence.
   */
  async executeOrderTx(tx: EntityManager, orderId: string, fillPrice: number): Promise<void> {
    const order = await this.orders.findById(orderId, tx);
    if (!order) throw new ApiError(`order ${orderId} missing`, 404, "not_found");
    if (order.status !== "PENDING") return;

    try {
      const portfolio = await this.ensurePortfolio(tx, order.userId);

      if (order.side === "BUY") {
        await this.settleBuy(tx, portfolio, order.symbol, order.quantity, fillPrice);
      } else {
        await this.settleSell(tx, portfolio, order.symbol, order.quantity, fillPrice);
      }

      await this.markExecuted(tx, order, fillPrice);
    } catch (err: any) {
      await this.markFailed(tx, order, err.message ?? "unknown");
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  //  SETTLEMENT  —  move money + shares for a fill
  // ──────────────────────────────────────────────────────────────────

  private async settleBuy(tx: EntityManager, portfolio: Portfolio, symbol: string, qty: string, price: number) {
    // shares go up, cash goes down
    await this.applyHoldingDelta(tx, portfolio, symbol, qty, price);
    portfolio.cashBalance = subCash(portfolio.cashBalance, cost(qty, price));
    await this.portfolios.save(portfolio, tx);
  }

  private async settleSell(tx: EntityManager, portfolio: Portfolio, symbol: string, qty: string, price: number) {
    // shares go down, cash goes up
    await this.applyHoldingDelta(tx, portfolio, symbol, d(qty).negated().toString(), price);
    portfolio.cashBalance = addCash(portfolio.cashBalance, cost(qty, price));
    await this.portfolios.save(portfolio, tx);
  }

  /**
   * Apply a signed quantity delta to a holding.
   *  - positive delta (buy)  → create or grow position; recompute weighted avgCost
   *  - negative delta (sell) → shrink position; avgCost unchanged
   * Rejects selling a symbol with no position or overselling an existing one.
   */
  private async applyHoldingDelta(tx: EntityManager, portfolio: Portfolio, symbol: string, qtyDelta: string, price: number) {
    const existing = await this.holdings.findByPortfolioAndSymbol(portfolio.id, symbol, tx);

    if (!existing) {
      if (d(qtyDelta).isNegative()) throw new ApiError(`cannot sell ${symbol}: no position`, 400, "validation_error");
      const fresh = this.holdings.create({ portfolio, symbol, quantity: qtyDelta, avgCost: String(price) }, tx);
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

  // ──────────────────────────────────────────────────────────────────
  //  STATE TRANSITIONS  —  the only place we mutate order.status
  // ──────────────────────────────────────────────────────────────────

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

  // ──────────────────────────────────────────────────────────────────
  //  HELPERS
  // ──────────────────────────────────────────────────────────────────

  private async ensurePortfolio(tx: EntityManager, userId: string): Promise<Portfolio> {
    const existing = await this.portfolios.findByUserId(userId, tx);
    if (existing) return existing;
    return this.portfolios.create({ userId, cashBalance: DEMO_SEED_CASH }, tx);
  }
}
