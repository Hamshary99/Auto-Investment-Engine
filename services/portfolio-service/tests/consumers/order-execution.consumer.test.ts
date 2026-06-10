// We cannot easily inject `userPortfolios` into the jest.mock because it is instantiated later.
// However, we can use a global or we can mock AppDataSource inside the `buildHarness` function.
// Since `AppDataSource` is an imported object, we can mutate its `transaction` method inside `buildHarness`.

jest.mock("../../src/data-source", () => ({
  AppDataSource: { transaction: jest.fn() },
}));

import { AppDataSource } from "../../src/data-source";

import { startOrderExecutionConsumer } from "../../src/consumers/order-execution.consumer";
import { OrderService } from "../../src/services/order.service";
import { FakeOrderRepository } from "../fakes/fake-order.repository";
import { FakeUserPortfolioRepository } from "../fakes/fake-user-portfolio.repository";
import { FakeHoldingRepository } from "../fakes/fake-holding.repository";
import { FakeAutoInvestPlanRepository } from "../fakes/fake-investment-plan.repositories";
import { OrderSide } from "../../src/models/types";
import { FakePublisher } from "../fakes/fake-publisher";
import { FakeProcessedMessageRepository } from "../fakes/fake-processed-message.repository";
import { FakeChannel } from "../fakes/fake-channel";
import { ROUTING_KEYS } from "@auto-invest/shared";

const USER = "11111111-1111-1111-1111-111111111111";

async function buildHarness() {
  const channel = new FakeChannel();
  const ctx = { channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any };

  const orders = new FakeOrderRepository();
  const userPortfolios = new FakeUserPortfolioRepository();
  const holdings = new FakeHoldingRepository();
  const publisher = new FakePublisher();
  const inbox = new FakeProcessedMessageRepository();
  const plans = new FakeAutoInvestPlanRepository();
  const orderService = new OrderService(orders, userPortfolios, holdings, publisher, plans);

  (AppDataSource.transaction as jest.Mock).mockImplementation(async (cb) => {
    const fakeTx = {
      getRepository: (entity: any) => ({
        findOne: async ({ where }: any) => {
          if (entity.name === "UserPortfolio") return userPortfolios.findByUserId(where.userId);
          if (entity.name === "AutoInvestPlan") return plans.findById(where.id);
          return null;
        },
        save: async (val: any) => val,
      }),
    };
    return cb(fakeTx);
  });

  await startOrderExecutionConsumer(ctx, orderService, {} as any, inbox);
  const pendingOrder = await orderService.placeOrder(USER, { symbol: "AAPL", side: OrderSide.BUY, quantity: 10 });
  return { channel, orders, userPortfolios, holdings, inbox, pendingOrder };
}

function buildEnvelope(opts: {
  orderId: string;
  messageId?: string;
  symbol?: string;
  priceHint?: number;
}) {
  return {
    messageId: opts.messageId ?? "msg-1",
    occurredAt: "2026-05-12T00:00:00.000Z",
    type: ROUTING_KEYS.ORDER_CREATED,
    payload: {
      orderId: opts.orderId,
      userId: USER,
      symbol: opts.symbol ?? "AAPL",
      side: "BUY",
      quantity: 10,
      priceHint: opts.priceHint,
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  order-execution consumer
// ════════════════════════════════════════════════════════════════════════════
describe("order-execution consumer", () => {
  it("happy path: executes the order, debits cash, records messageId, ack's", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, orders, userPortfolios, inbox, pendingOrder } = await buildHarness();
    const envelope = buildEnvelope({
      orderId: pendingOrder.id,
      messageId: "msg-1",
      priceHint: 150,
    });

    // ── ACT ───────────────────────────────────────────────────────────
    // RabbitMQ delivers the envelope through the consumer
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // order:    status = "EXECUTED"
    // cash:     100000.00 → 98500.00      (= 100000 - 10*150)
    // inbox:    contains "msg-1"
    // channel:  1 ack, 0 rejects
    expect((await orders.findById(pendingOrder.id))?.status).toBe("EXECUTED");
    expect((await userPortfolios.findByUserId(USER))?.cashBalance).toBe("98500.00");
    expect(inbox.seen.has("msg-1")).toBe(true);
    expect(channel.acks).toHaveLength(1);
    expect(channel.rejects).toHaveLength(0);
  });

  it("duplicate delivery: inbox guard kicks in, side-effect runs only once, both ack", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // RabbitMQ redelivers the same envelope twice (same messageId).
    const { channel, orders, userPortfolios, pendingOrder } = await buildHarness();
    const envelope = buildEnvelope({ orderId: pendingOrder.id, messageId: "msg-1", priceHint: 150 });

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // order:   EXECUTED exactly once
    // cash:    debited exactly once (98500.00, not 97000.00)
    // channel: 2 acks, 0 rejects   (second delivery acked-and-skipped)
    expect((await orders.findById(pendingOrder.id))?.status).toBe("EXECUTED");
    expect((await userPortfolios.findByUserId(USER))?.cashBalance).toBe("98500.00");
    expect(channel.acks).toHaveLength(2);
    expect(channel.rejects).toHaveLength(0);
  });

  it("handler throws (unknown order id): consumer rejects → DLQ, no requeue", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel } = await buildHarness();
    const envelope = buildEnvelope({
      orderId: "ghost-order-id",
      messageId: "msg-ghost",
      priceHint: 100,
    });

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // channel:  0 acks, 1 reject, requeue = false  (→ DLX → DLQ)
    expect(channel.acks).toHaveLength(0);
    expect(channel.rejects).toEqual([{ msg: expect.anything(), requeue: false }]);
  });
});
