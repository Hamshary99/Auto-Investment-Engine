import { EntityManager } from "typeorm";
import { v4 as uuid } from "uuid";
import { AppDataSource } from "../data-source";
import { Order, OrderSide } from "../entities/Order";
import { Portfolio } from "../entities/Portfolio";
import { OrderRepository } from "../repositories/order.repository";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import { HoldingRepository } from "../repositories/holding.repository";
import { NotFoundError, Publisher, ROUTING_KEYS, ValidationError } from "@auto-invest/shared";

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly portfolios: PortfolioRepository,
    private readonly holdings: HoldingRepository,
    private readonly publisher: Publisher
  ) {}

  async createOrder(userId: string, input: { symbol: string; side: OrderSide; quantity: number }) {
    if (!input.symbol || !input.side || !input.quantity || input.quantity <= 0) {
      throw new ValidationError("symbol, side, quantity>0 required");
    }
    const saved = await AppDataSource.transaction(async (tx) => {
      await this.ensurePortfolio(tx, userId);
      return this.orders.create(
        { userId, symbol: input.symbol.toUpperCase(), side: input.side, quantity: String(input.quantity), status: "PENDING" },
        tx
      );
    });

    await this.publisher.publish(ROUTING_KEYS.ORDER_CREATED, {
      orderId: saved.id,
      userId,
      symbol: saved.symbol,
      side: saved.side,
      quantity: Number(saved.quantity),
    }, uuid());

    return saved;
  }

  async findById(userId: string, id: string) {
    const o = await this.orders.findByIdForUser(id, userId);
    if (!o) throw new NotFoundError("order not found");
    return o;
  }

  /**
   * State machine: PENDING → EXECUTED | FAILED. Side-effect-only — idempotency
   * is enforced by the ProcessedMessage inbox at the consumer layer.
   */
  async executeOrderTx(tx: EntityManager, orderId: string, fillPrice: number): Promise<void> {
    const order = await this.orders.findById(orderId, tx);
    if (!order) throw new NotFoundError(`order ${orderId} missing`);
    if (order.status !== "PENDING") return; // already terminal — no-op

    try {
      const portfolio = await this.ensurePortfolio(tx, order.userId);
      const qty = Number(order.quantity);
      const cost = qty * fillPrice;

      if (order.side === "BUY") {
        await this.upsertHolding(tx, portfolio, order.symbol, qty, fillPrice);
        portfolio.cashBalance = (Number(portfolio.cashBalance) - cost).toFixed(2);
      } else {
        await this.upsertHolding(tx, portfolio, order.symbol, -qty, fillPrice);
        portfolio.cashBalance = (Number(portfolio.cashBalance) + cost).toFixed(2);
      }
      await this.portfolios.save(portfolio, tx);

      order.status = "EXECUTED";
      order.executedPrice = String(fillPrice);
      await this.orders.save(order, tx);
    } catch (err: any) {
      order.status = "FAILED";
      order.failureReason = err.message?.slice(0, 500) ?? "unknown";
      await this.orders.save(order, tx);
      throw err;
    }
  }

  private async ensurePortfolio(tx: EntityManager, userId: string): Promise<Portfolio> {
    const existing = await this.portfolios.findByUserId(userId, tx);
    if (existing) return existing;
    return this.portfolios.create({ userId, cashBalance: "100000.00" }, tx); // demo seed
  }

  private async upsertHolding(tx: EntityManager, portfolio: Portfolio, symbol: string, qtyDelta: number, price: number) {
    let h = await this.holdings.findByPortfolioAndSymbol(portfolio.id, symbol, tx);
    if (!h) {
      if (qtyDelta < 0) throw new ValidationError(`cannot sell ${symbol}: no position`);
      h = this.holdings.create({ portfolio, symbol, quantity: String(qtyDelta), avgCost: String(price) }, tx);
    } else {
      const oldQty = Number(h.quantity);
      const newQty = oldQty + qtyDelta;
      if (newQty < 0) throw new ValidationError(`oversell on ${symbol}`);
      if (qtyDelta > 0) {
        const newAvg = (oldQty * Number(h.avgCost) + qtyDelta * price) / newQty;
        h.avgCost = newAvg.toFixed(6);
      }
      h.quantity = newQty.toFixed(6);
    }
    await this.holdings.save(h, tx);
  }
}
