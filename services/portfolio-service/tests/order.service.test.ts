// Mock AppDataSource.transaction so callbacks run inline with no real DB.
// The fake repos ignore the EntityManager argument, so passing undefined is fine.
jest.mock("../src/data-source", () => ({
  AppDataSource: {
    transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)),
  },
}));

import { OrderService } from "../src/services/order.service";
import { FakeOrderRepository } from "./fakes/fake-order.repository";
import { FakePortfolioRepository } from "./fakes/fake-portfolio.repository";
import { FakeHoldingRepository } from "./fakes/fake-holding.repository";
import { FakePublisher } from "./fakes/fake-publisher";
import { NotFoundError, ROUTING_KEYS, ValidationError } from "@auto-invest/shared";

const USER = "11111111-1111-1111-1111-111111111111";
const SEED_CASH = "100000.00"; // portfolio is auto-seeded with this on first order

function buildSut() {
  const orders = new FakeOrderRepository();
  const portfolios = new FakePortfolioRepository();
  const holdings = new FakeHoldingRepository();
  const publisher = new FakePublisher();
  const service = new OrderService(orders, portfolios, holdings, publisher);
  return { service, orders, portfolios, holdings, publisher };
}

// ════════════════════════════════════════════════════════════════════════════
//  createOrder
// ════════════════════════════════════════════════════════════════════════════
describe("OrderService.createOrder", () => {
  it("persists a PENDING order, seeds a portfolio, and publishes order.created", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const input = {
      userId: USER,
      order: { symbol: "aapl", side: "BUY" as const, quantity: 10 },
    };
    const { service, orders, portfolios, publisher } = buildSut();

    // ── ACT ───────────────────────────────────────────────────────────
    const saved = await service.createOrder(input.userId, input.order);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // saved order:          { userId, symbol: "AAPL" (uppercased), side: "BUY", quantity: "10", status: "PENDING" }
    // orders table:         1 row
    // portfolio (seeded):   { userId, cashBalance: "100000.00" }
    // events published:     1  →  ORDER_CREATED { orderId, userId, "AAPL", "BUY", 10 }
    expect(saved).toMatchObject({
      userId: USER, symbol: "AAPL", side: "BUY", quantity: "10", status: "PENDING",
    });
    expect(orders.all()).toHaveLength(1);
    expect((await portfolios.findByUserId(USER))?.cashBalance).toBe(SEED_CASH);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]).toMatchObject({
      routingKey: ROUTING_KEYS.ORDER_CREATED,
      payload: { orderId: saved.id, userId: USER, symbol: "AAPL", side: "BUY", quantity: 10 },
    });
  });

  it.each([
    // [label,            input,                                            ]
    ["missing symbol",    { symbol: "",     side: "BUY", quantity: 1 }],
    ["missing side",      { symbol: "AAPL", side: "",    quantity: 1 }],
    ["zero quantity",     { symbol: "AAPL", side: "BUY", quantity: 0 }],
    ["negative quantity", { symbol: "AAPL", side: "BUY", quantity: -5 }],
  ])("rejects invalid input — %s", async (_label, badInput) => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // badInput  (see table above)
    const { service, orders, publisher } = buildSut();

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    // throws ValidationError, no order persisted, no event published
    await expect(service.createOrder(USER, badInput as any)).rejects.toBeInstanceOf(ValidationError);
    expect(orders.all()).toHaveLength(0);
    expect(publisher.published).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  findById
// ════════════════════════════════════════════════════════════════════════════
describe("OrderService.findById", () => {
  it("returns the order when it belongs to the requesting user", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service } = buildSut();
    const created = await service.createOrder(USER, { symbol: "MSFT", side: "BUY", quantity: 1 });
    const lookup = { userId: USER, orderId: created.id };

    // ── ACT ───────────────────────────────────────────────────────────
    const found = await service.findById(lookup.userId, lookup.orderId);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // returns the same Order row that was just created
    expect(found.id).toBe(created.id);
  });

  it("throws NotFoundError when the order belongs to a different user", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service } = buildSut();
    const created = await service.createOrder(USER, { symbol: "MSFT", side: "BUY", quantity: 1 });
    const lookup = { userId: "other-user", orderId: created.id };

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    // throws NotFoundError (no leak that the id exists for someone else)
    await expect(service.findById(lookup.userId, lookup.orderId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws NotFoundError for an unknown order id", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service } = buildSut();
    const lookup = { userId: USER, orderId: "no-such-id" };

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    await expect(service.findById(lookup.userId, lookup.orderId)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  executeOrderTx  —  the state machine + holdings/cash math
// ════════════════════════════════════════════════════════════════════════════
describe("OrderService.executeOrderTx", () => {
  it("BUY: creates a holding, decrements cash, transitions order PENDING → EXECUTED", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders, portfolios, holdings } = buildSut();
    const pending = await service.createOrder(USER, { symbol: "AAPL", side: "BUY", quantity: 10 });
    const fill = { orderId: pending.id, price: 150 };

    // ── ACT ───────────────────────────────────────────────────────────
    await service.executeOrderTx(undefined as any, fill.orderId, fill.price);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // order:     { status: "EXECUTED", executedPrice: "150" }
    // holding:   { symbol: "AAPL", quantity: "10",  avgCost: "150" }
    // cash:      100000.00  →  98500.00   (= 100000 - 10*150)
    expect(await orders.findById(pending.id)).toMatchObject({ status: "EXECUTED", executedPrice: "150" });
    const portfolio = (await portfolios.findByUserId(USER))!;
    expect(holdings.get(portfolio.id, "AAPL")).toMatchObject({ quantity: "10", avgCost: "150" });
    expect(portfolio.cashBalance).toBe("98500.00");
  });

  it("BUY then BUY: weighted-average cost across two fills", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const fills = [
      { qty: 10, price: 100 }, // total cost 1000
      { qty: 10, price: 200 }, // total cost 2000
    ];
    const { service, portfolios, holdings } = buildSut();

    // ── ACT ───────────────────────────────────────────────────────────
    for (const f of fills) {
      const o = await service.createOrder(USER, { symbol: "AAPL", side: "BUY", quantity: f.qty });
      await service.executeOrderTx(undefined as any, o.id, f.price);
    }

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // holding:   { quantity: "20.000000", avgCost: ~150 }   (1000+2000)/20 = 150
    // cash:      100000.00  →  97000.00
    const portfolio = (await portfolios.findByUserId(USER))!;
    const holding = holdings.get(portfolio.id, "AAPL")!;
    expect(holding.quantity).toBe("20.000000");
    expect(Number(holding.avgCost)).toBeCloseTo(150, 6);
    expect(portfolio.cashBalance).toBe("97000.00");
  });

  it("SELL: decrements quantity, increments cash, avgCost unchanged", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // setup: own 10 AAPL @ avg 100
    const { service, orders, portfolios, holdings } = buildSut();
    const buy = await service.createOrder(USER, { symbol: "AAPL", side: "BUY", quantity: 10 });
    await service.executeOrderTx(undefined as any, buy.id, 100);
    const sell = await service.createOrder(USER, { symbol: "AAPL", side: "SELL", quantity: 4 });
    const fill = { orderId: sell.id, price: 120 };

    // ── ACT ───────────────────────────────────────────────────────────
    await service.executeOrderTx(undefined as any, fill.orderId, fill.price);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // sell order:  { status: "EXECUTED" }
    // holding:     { quantity: ~6, avgCost: "100" }   (avgCost not changed by sells)
    // cash:        100000 - 10*100 + 4*120  =  99480.00
    const portfolio = (await portfolios.findByUserId(USER))!;
    const holding = holdings.get(portfolio.id, "AAPL")!;
    expect((await orders.findById(sell.id))?.status).toBe("EXECUTED");
    expect(Number(holding.quantity)).toBeCloseTo(6, 6);
    expect(holding.avgCost).toBe("100");
    expect(portfolio.cashBalance).toBe("99480.00");
  });

  it("SELL with no position: order goes FAILED, no phantom holding is created", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders, portfolios, holdings } = buildSut();
    const sell = await service.createOrder(USER, { symbol: "TSLA", side: "SELL", quantity: 1 });
    const fill = { orderId: sell.id, price: 100 };

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    // throws ValidationError
    // order:     { status: "FAILED", failureReason: /no position/ }
    // holding:   none for TSLA
    await expect(service.executeOrderTx(undefined as any, fill.orderId, fill.price))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await orders.findById(sell.id)).toMatchObject({
      status: "FAILED",
      failureReason: expect.stringMatching(/no position/i),
    });
    const portfolio = (await portfolios.findByUserId(USER))!;
    expect(holdings.get(portfolio.id, "TSLA")).toBeUndefined();
  });

  it("oversell: order goes FAILED, existing holding qty untouched", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // setup: own 5 AAPL; try to sell 999
    const { service, orders, portfolios, holdings } = buildSut();
    const buy = await service.createOrder(USER, { symbol: "AAPL", side: "BUY", quantity: 5 });
    await service.executeOrderTx(undefined as any, buy.id, 100);
    const oversell = await service.createOrder(USER, { symbol: "AAPL", side: "SELL", quantity: 999 });

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    // throws ValidationError
    // oversell order: { status: "FAILED", failureReason: /oversell/ }
    // holding qty:    still "5"
    await expect(service.executeOrderTx(undefined as any, oversell.id, 100))
      .rejects.toBeInstanceOf(ValidationError);
    expect(await orders.findById(oversell.id)).toMatchObject({
      status: "FAILED",
      failureReason: expect.stringMatching(/oversell/i),
    });
    const portfolio = (await portfolios.findByUserId(USER))!;
    expect(holdings.get(portfolio.id, "AAPL")!.quantity).toBe("5");
  });

  it("already-terminal order is a no-op (replay-safe state machine)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // Buy 1 AAPL @ 50, then ask the engine to execute the SAME order again.
    const { service, orders, portfolios } = buildSut();
    const buy = await service.createOrder(USER, { symbol: "AAPL", side: "BUY", quantity: 1 });
    await service.executeOrderTx(undefined as any, buy.id, 50);
    const cashAfterFirstFill = (await portfolios.findByUserId(USER))!.cashBalance;

    // ── ACT ───────────────────────────────────────────────────────────
    // second execute on an already-EXECUTED order
    await service.executeOrderTx(undefined as any, buy.id, 50);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // cash unchanged from first fill (not double-debited)
    // order still EXECUTED
    expect((await portfolios.findByUserId(USER))!.cashBalance).toBe(cashAfterFirstFill);
    expect((await orders.findById(buy.id))?.status).toBe("EXECUTED");
  });

  it("unknown order id: throws NotFoundError", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service } = buildSut();
    const fill = { orderId: "missing-id", price: 100 };

    // ── ACT + EXPECTED OUTPUT ─────────────────────────────────────────
    await expect(service.executeOrderTx(undefined as any, fill.orderId, fill.price))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
