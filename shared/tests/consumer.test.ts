import { startConsumer } from "../src/rabbitmq/consumer";
import { ROUTING_KEYS } from "../src/events/types";
import { FakeChannel } from "./fake-channel";

function buildCtx(channel: FakeChannel) {
  return { channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any };
}

describe("startConsumer (RabbitMQ wrapper)", () => {
  // ────────────────────────────────────────────────────────────────
  // topology
  // ────────────────────────────────────────────────────────────────
  describe("queue + DLQ topology", () => {
    it("declares the queue with x-dead-letter-exchange pointing at a per-queue DLX", async () => {
      // INPUT
      const channel = new FakeChannel();
      // ACT
      await startConsumer(buildCtx(channel),
        { queue: "portfolio.test", routingKeys: [ROUTING_KEYS.ORDER_CREATED] },
        async () => {}
      );
      // OUTPUT — DLX declared as fanout, DLQ bound to it, main queue dead-letters to DLX
      expect(channel.exchanges).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "portfolio.test.dlx", type: "fanout", options: { durable: true } }),
      ]));
      expect(channel.queues).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: "portfolio.test.dlq", options: { durable: true } }),
        expect.objectContaining({
          name: "portfolio.test",
          options: { durable: true, deadLetterExchange: "portfolio.test.dlx" },
        }),
      ]));
      expect(channel.bindings).toEqual(expect.arrayContaining([
        { queue: "portfolio.test.dlq", exchange: "portfolio.test.dlx", routingKey: "" },
      ]));
    });

    it("binds the queue to every supplied routing key on the main exchange", async () => {
      // INPUT
      const channel = new FakeChannel();
      const keys = [ROUTING_KEYS.RECONCILIATION_REQUESTED, ROUTING_KEYS.ORDER_SWEEP_REQUESTED];
      // ACT
      await startConsumer(buildCtx(channel), { queue: "q", routingKeys: keys }, async () => {});
      // OUTPUT
      for (const k of keys) {
        expect(channel.bindings).toContainEqual({ queue: "q", exchange: "auto-invest.events", routingKey: k });
      }
    });

    it("applies the prefetch value (default 10)", async () => {
      // default
      const c1 = new FakeChannel();
      await startConsumer(buildCtx(c1), { queue: "q", routingKeys: [ROUTING_KEYS.ORDER_CREATED] }, async () => {});
      expect(c1.prefetchCount).toBe(10);
      // explicit
      const c2 = new FakeChannel();
      await startConsumer(buildCtx(c2), { queue: "q", routingKeys: [ROUTING_KEYS.ORDER_CREATED], prefetch: 1 }, async () => {});
      expect(c2.prefetchCount).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // delivery
  // ────────────────────────────────────────────────────────────────
  describe("message delivery", () => {
    it("invokes the handler with the parsed envelope and ack's on success", async () => {
      // INPUT
      const channel = new FakeChannel();
      const received: any[] = [];
      await startConsumer(buildCtx(channel),
        { queue: "q", routingKeys: [ROUTING_KEYS.ORDER_CREATED] },
        async (env) => { received.push(env); }
      );

      const envelope = {
        messageId: "abc-123",
        occurredAt: "2026-05-12T00:00:00.000Z",
        type: ROUTING_KEYS.ORDER_CREATED,
        payload: { orderId: "o-1" },
      };

      // ACT
      await channel.deliver(envelope, { messageId: "abc-123" });

      // OUTPUT
      expect(received).toEqual([envelope]);
      expect(channel.acks).toHaveLength(1);
      expect(channel.rejects).toHaveLength(0);
    });

    it("on handler throw: rejects (no requeue) so message dead-letters to DLX → DLQ", async () => {
      const channel = new FakeChannel();
      await startConsumer(buildCtx(channel),
        { queue: "q", routingKeys: [ROUTING_KEYS.ORDER_CREATED] },
        async () => { throw new Error("boom"); }
      );

      await channel.deliver({ messageId: "m1", type: "x", payload: {}, occurredAt: "" });

      expect(channel.acks).toHaveLength(0);
      expect(channel.rejects).toHaveLength(1);
      expect(channel.rejects[0].requeue).toBe(false);
    });

    it("uses x-death header to count attempts; past maxRetries still rejects (lands in DLQ)", async () => {
      // simulates a redelivery that has already failed CONSUMER_MAX_RETRIES times
      const channel = new FakeChannel();
      await startConsumer(buildCtx(channel),
        { queue: "q", routingKeys: [ROUTING_KEYS.ORDER_CREATED], maxRetries: 2 },
        async () => { throw new Error("still failing"); }
      );

      await channel.deliver({ messageId: "m1", payload: {} }, { deathCount: 5 });

      expect(channel.rejects).toHaveLength(1);
      expect(channel.rejects[0].requeue).toBe(false);
    });

    it("null message (channel cancelled) is ignored — no ack, no reject, no handler call", async () => {
      const channel = new FakeChannel();
      const handler = jest.fn();
      await startConsumer(buildCtx(channel), { queue: "q", routingKeys: [ROUTING_KEYS.ORDER_CREATED] }, handler);

      // simulate broker-initiated cancel
      await (channel as any).consumer(null);

      expect(handler).not.toHaveBeenCalled();
      expect(channel.acks).toHaveLength(0);
      expect(channel.rejects).toHaveLength(0);
    });
  });
});
