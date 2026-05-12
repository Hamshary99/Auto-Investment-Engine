import type { Channel, ConsumeMessage } from "amqplib";

/**
 * In-memory stand-in for amqplib's Channel. Records every topology call
 * (assertExchange, assertQueue, bindQueue, prefetch) so tests can assert
 * how the queue was wired up, and captures the consume() handler so tests
 * can deliver fabricated messages and inspect ack/reject decisions.
 */
export class FakeChannel {
  exchanges: Array<{ name: string; type: string; options: any }> = [];
  queues: Array<{ name: string; options: any }> = [];
  bindings: Array<{ queue: string; exchange: string; routingKey: string }> = [];
  prefetchCount: number | null = null;
  published: Array<{ exchange: string; routingKey: string; content: Buffer; options: any }> = [];

  acks: ConsumeMessage[] = [];
  rejects: Array<{ msg: ConsumeMessage; requeue: boolean }> = [];

  private consumer?: (msg: ConsumeMessage | null) => Promise<void> | void;

  async assertExchange(name: string, type: string, options: any) {
    this.exchanges.push({ name, type, options });
    return { exchange: name };
  }
  async assertQueue(name: string, options: any) {
    this.queues.push({ name, options });
    return { queue: name, messageCount: 0, consumerCount: 0 };
  }
  async bindQueue(queue: string, exchange: string, routingKey: string) {
    this.bindings.push({ queue, exchange, routingKey });
    return {};
  }
  async prefetch(count: number) { this.prefetchCount = count; }

  publish(exchange: string, routingKey: string, content: Buffer, options: any) {
    this.published.push({ exchange, routingKey, content, options });
    return true;
  }

  consume(_queue: string, cb: (msg: ConsumeMessage | null) => Promise<void> | void) {
    this.consumer = cb;
    return Promise.resolve({ consumerTag: "fake" });
  }

  ack(msg: ConsumeMessage) { this.acks.push(msg); }
  reject(msg: ConsumeMessage, requeue: boolean) { this.rejects.push({ msg, requeue }); }

  /** Test driver: deliver a fabricated message through the registered consumer. */
  async deliver(body: unknown, opts: { messageId?: string; deathCount?: number } = {}) {
    if (!this.consumer) throw new Error("consume() not called yet");
    const msg: ConsumeMessage = {
      content: Buffer.from(JSON.stringify(body)),
      fields: { deliveryTag: 1, redelivered: false, exchange: "", routingKey: "", consumerTag: "fake" },
      properties: {
        messageId: opts.messageId ?? "msg-1",
        contentType: "application/json",
        headers: opts.deathCount ? { "x-death": [{ count: opts.deathCount }] } : {},
      } as any,
    };
    await this.consumer(msg);
  }

  asChannel(): Channel { return this as unknown as Channel; }
}
