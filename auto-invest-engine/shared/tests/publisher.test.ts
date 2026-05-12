import { Publisher } from "../src/rabbitmq/publisher";
import { ROUTING_KEYS } from "../src/events/types";
import { FakeChannel } from "./fake-channel";

describe("Publisher", () => {
  it("wraps payload in an envelope with messageId/occurredAt/type and marks it persistent", async () => {
    // INPUT
    const channel = new FakeChannel();
    const pub = new Publisher({ channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any });
    const payload = { orderId: "o-1", userId: "u-1", symbol: "AAPL", side: "BUY" as const, quantity: 5 };

    // ACT
    await pub.publish(ROUTING_KEYS.ORDER_CREATED, payload, "msg-fixed-uuid");

    // OUTPUT — routed to the right exchange + routing key
    expect(channel.published).toHaveLength(1);
    const p = channel.published[0];
    expect(p.exchange).toBe("auto-invest.events");
    expect(p.routingKey).toBe(ROUTING_KEYS.ORDER_CREATED);

    // OUTPUT — envelope shape
    const envelope = JSON.parse(p.content.toString());
    expect(envelope).toMatchObject({
      messageId: "msg-fixed-uuid",
      type: ROUTING_KEYS.ORDER_CREATED,
      payload,
    });
    expect(envelope.occurredAt).toEqual(expect.any(String));
    expect(new Date(envelope.occurredAt).getTime()).not.toBeNaN();

    // OUTPUT — broker-level properties
    expect(p.options).toMatchObject({
      persistent: true,
      messageId: "msg-fixed-uuid",
      contentType: "application/json",
    });
  });

  it("auto-generates a uuid messageId when none is supplied", async () => {
    const channel = new FakeChannel();
    const pub = new Publisher({ channel: channel.asChannel(), exchange: "x", connection: {} as any });
    await pub.publish(ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED, { forDate: "2026-05-12" });
    const envelope = JSON.parse(channel.published[0].content.toString());
    expect(envelope.messageId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
