// Mock AppDataSource.transaction so callbacks run inline with no real DB.
// The fake repos ignore the EntityManager argument, so passing undefined is fine.
jest.mock("../src/data-source", () => ({
  AppDataSource: {
    transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)),
  },
}));

import { OrderService } from "../src/services/order.service";
import { ApiError } from "../src/utils/error.handler";
import { FakeOrderRepository } from "./fakes/fake-order.repository";
import { FakeUserPortfolioRepository } from "./fakes/fake-user-portfolio.repository";
import { FakeHoldingRepository } from "./fakes/fake-holding.repository";
import { FakePublisher } from "./fakes/fake-publisher";
import { ROUTING_KEYS } from "@auto-invest/shared";
import { OrderSide } from "../src/models/types";

const USER = "11111111-1111-1111-1111-111111111111";
const SEED_CASH = "100000.00";

function buildSut() {
  const orders = new FakeOrderRepository();
  const userPortfolios = new FakeUserPortfolioRepository();
  const holdings = new FakeHoldingRepository();
  const publisher = new FakePublisher();
  const service = new OrderService(orders, userPortfolios, holdings, publisher, {} as any);
  return { service, orders, userPortfolios, holdings, publisher };
}

// ════════════════════════════════════════════════════════════════════════════
//  placeOrder
// ════════════════════════════════════════════════════════════════════════════
describe("OrderService.placeOrder", () => {
  it("persists a PENDING order, seeds a portfolio, and publishes order.created", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const input = {
      userId: USER,
      order: { symbol: "aapl", side: OrderSide.BUY as const, quantity: 10 },
    };
    const { service, orders, userPortfolios, publisher } = buildSut();

    // ── ACT ───────────────────────────────────────────────────────────
    const saved = await service.placeOrder(input.userId, input.order);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // saved order:        { symbol: "AAPL" (uppercased), side, quantity: "10", status: "PENDING" }
    // orders table:       1 row
    // seeded portfolio:   { cashBalance: "100000.00" }
    // events published:   1  →  ORDER_CREATED
    expect(saved).toMatchObject({
      userId: USER, symbol: "AAPL", side: OrderSide.BUY, quantity: "10", status: "PENDING",
    });
    expect(orders.all()).toHaveLength(1);
    expect((await userPortfolios.findByUserId(USER))?.cashBalance).toBe(SEED_CASH);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]).toMatchObject({
      routingKey: ROUTING_KEYS.ORDER_CREATED,
      payload: { orderId: saved.id, userId: USER, symbol: "AAPL", side: OrderSide.BUY, quantity: 10 },
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  findOrderForUser
// ════════════════════════════════════════════════════════════════════════════
describe("OrderService.findOrderForUser", () => {
  it("returns the order when it belongs to the requesting user", async () => {
    const { service } = buildSut();
    const created = await service.placeOrder(USER, { symbol: "MSFT", side: OrderSide.BUY, quantity: 1 });
    const found = await service.findOrderForUser(USER, created.id);
    expect(found.id).toBe(created.id);
  });

  it("throws ApiError(404) when the order belongs to a different user", async () => {
    const { service } = buildSut();
    const created = await service.placeOrder(USER, { symbol: "MSFT", side: OrderSide.BUY, quantity: 1 });
    const err = await service.findOrderForUser("other-user", created.id).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });

  it("throws ApiError(404) for an unknown order id", async () => {
    const { service } = buildSut();
    const err = await service.findOrderForUser(USER, "no-such-id").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  executeOrderTx  —  state machine + holdings/cash math
// ════════════════════════════════════════════════════════════════════════════
describe("OrderService.executeOrderTx", () => {
  it("BUY: creates a holding, decrements cash, transitions PENDING → EXECUTED", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders, userPortfolios, holdings } = buildSut();
    const pending = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.BUY, quantity: 10 });
    const fill = { orderId: pending.id, price: 150 };

    // ── ACT ───────────────────────────────────────────────────────────
    await service.executeOrderTx(undefined as any, fill.orderId, fill.price);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // order:     { status: "EXECUTED", executedPrice: "150" }
    // holding:   { quantity: "10", avgCost: "150" }
    // cash:      100000.00 → 98500.00   (= 100000 - 10*150)
    expect(await orders.findById(pending.id)).toMatchObject({ status: "EXECUTED", executedPrice: "150" });
    const userPortfolio = (await userPortfolios.findByUserId(USER))!;
    expect(holdings.get(userPortfolio.id, "AAPL")).toMatchObject({ quantity: "10", avgCost: "150" });
    expect(userPortfolio.cashBalance).toBe("98500.00");
  });

  it("BUY then BUY: weighted-average cost across two fills", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const fills = [{ qty: 10, price: 100 }, { qty: 10, price: 200 }];
    const { service, userPortfolios, holdings } = buildSut();

    // ── ACT ───────────────────────────────────────────────────────────
    for (const f of fills) {
      const o = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.BUY, quantity: f.qty });
      await service.executeOrderTx(undefined as any, o.id, f.price);
    }

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // holding:  { quantity: "20.000000", avgCost: ~150 }  (1000+2000)/20
    // cash:     100000.00 → 97000.00
    const userPortfolio = (await userPortfolios.findByUserId(USER))!;
    const holding = holdings.get(userPortfolio.id, "AAPL")!;
    expect(holding.quantity).toBe("20.000000");
    expect(Number(holding.avgCost)).toBeCloseTo(150, 6);
    expect(userPortfolio.cashBalance).toBe("97000.00");
  });

  it("SELL: decrements quantity, increments cash, avgCost unchanged", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // setup: own 10 AAPL @ avg 100
    const { service, orders, userPortfolios, holdings } = buildSut();
    const buy = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.BUY, quantity: 10 });
    await service.executeOrderTx(undefined as any, buy.id, 100);
    const sell = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.SELL, quantity: 4 });
    const fill = { orderId: sell.id, price: 120 };

    // ── ACT ───────────────────────────────────────────────────────────
    await service.executeOrderTx(undefined as any, fill.orderId, fill.price);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // sell order:  EXECUTED
    // holding:     qty ≈ 6, avgCost still "100"
    // cash:        100000 - 1000 + 4*120 = 99480.00
    const userPortfolio = (await userPortfolios.findByUserId(USER))!;
    const holding = holdings.get(userPortfolio.id, "AAPL")!;
    expect((await orders.findById(sell.id))?.status).toBe("EXECUTED");
    expect(Number(holding.quantity)).toBeCloseTo(6, 6);
    expect(holding.avgCost).toBe("100");
    expect(userPortfolio.cashBalance).toBe("99480.00");
  });

  it("SELL with no position: order goes FAILED with reason, no holding created", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders, userPortfolios, holdings } = buildSut();
    const sell = await service.placeOrder(USER, { symbol: "TSLA", side: OrderSide.SELL, quantity: 1 });

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    // throws ApiError(400 "validation_error"); order goes FAILED with /no position/
    const err = await service.executeOrderTx(undefined as any, sell.id, 100).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);

    expect(await orders.findById(sell.id)).toMatchObject({
      status: "FAILED",
      failureReason: expect.stringMatching(/no position/i),
    });
    const userPortfolio = (await userPortfolios.findByUserId(USER))!;
    expect(holdings.get(userPortfolio.id, "TSLA")).toBeUndefined();
  });

  it("oversell: order goes FAILED, existing holding qty untouched", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders, userPortfolios, holdings } = buildSut();
    const buy = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.BUY, quantity: 5 });
    await service.executeOrderTx(undefined as any, buy.id, 100);
    const oversell = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.SELL, quantity: 999 });

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    const err = await service.executeOrderTx(undefined as any, oversell.id, 100).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);

    expect(await orders.findById(oversell.id)).toMatchObject({
      status: "FAILED",
      failureReason: expect.stringMatching(/oversell/i),
    });
    const userPortfolio = (await userPortfolios.findByUserId(USER))!;
    expect(holdings.get(userPortfolio.id, "AAPL")!.quantity).toBe("5");
  });

  it("already-terminal order is a no-op (replay-safe)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders, userPortfolios } = buildSut();
    const buy = await service.placeOrder(USER, { symbol: "AAPL", side: OrderSide.BUY, quantity: 1 });
    await service.executeOrderTx(undefined as any, buy.id, 50);
    const cashAfterFirstFill = (await userPortfolios.findByUserId(USER))!.cashBalance;

    // ── ACT ───────────────────────────────────────────────────────────
    await service.executeOrderTx(undefined as any, buy.id, 50);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // cash unchanged from first fill (not double-debited); order still EXECUTED
    expect((await userPortfolios.findByUserId(USER))!.cashBalance).toBe(cashAfterFirstFill);
    expect((await orders.findById(buy.id))?.status).toBe("EXECUTED");
  });

  it("unknown order id: throws ApiError(404)", async () => {
    const { service } = buildSut();
    const err = await service.executeOrderTx(undefined as any, "missing-id", 100).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(404);
  });
});
