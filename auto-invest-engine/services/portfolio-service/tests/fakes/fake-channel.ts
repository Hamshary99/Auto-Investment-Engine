import type { Channel, ConsumeMessage } from "amqplib";

/**
 * Minimal in-memory amqplib Channel. Captures consume() so tests can
 * deliver fabricated messages and inspect ack/reject decisions.
 */
export class FakeChannel {
  acks: ConsumeMessage[] = [];
  rejects: Array<{ msg: ConsumeMessage; requeue: boolean }> = [];
  published: Array<{ exchange: string; routingKey: string; content: Buffer; options: any }> = [];
  private consumer?: (msg: ConsumeMessage | null) => Promise<void> | void;

  async assertExchange() { return {}; }
  async assertQueue() { return { queue: "", messageCount: 0, consumerCount: 0 }; }
  async bindQueue() { return {}; }
  async prefetch() { /* noop */ }
  publish(exchange: string, routingKey: string, content: Buffer, options: any) {
    this.published.push({ exchange, routingKey, content, options });
    return true;
  }
  consume(_q: string, cb: (m: ConsumeMessage | null) => Promise<void> | void) {
    this.consumer = cb;
    return Promise.resolve({ consumerTag: "fake" });
  }
  ack(msg: ConsumeMessage) { this.acks.push(msg); }
  reject(msg: ConsumeMessage, requeue: boolean) { this.rejects.push({ msg, requeue }); }

  async deliver(envelope: unknown, opts: { messageId?: string } = {}) {
    if (!this.consumer) throw new Error("consume() not called");
    const msg: ConsumeMessage = {
      content: Buffer.from(JSON.stringify(envelope)),
      fields: { deliveryTag: 1, redelivered: false, exchange: "", routingKey: "", consumerTag: "fake" },
      properties: {
        messageId: opts.messageId ?? "msg",
        contentType: "application/json",
        headers: {},
      } as any,
    };
    await this.consumer(msg);
  }

  asChannel(): Channel { return this as unknown as Channel; }
}
