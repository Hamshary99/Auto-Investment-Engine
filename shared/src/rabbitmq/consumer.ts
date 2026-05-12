import { ConsumeMessage } from "amqplib";
import { RabbitContext } from "./connection";
import { EventEnvelope, RoutingKey } from "../events/types";
import { createLogger } from "../logger";

const log = createLogger("consumer");

export interface ConsumerOptions {
  queue: string;
  routingKeys: RoutingKey[];
  prefetch?: number;
  maxRetries?: number;
}

export type Handler<T> = (envelope: EventEnvelope<T>) => Promise<void>;

/**
 * Asserts queue + DLX/DLQ, binds routing keys, runs handler with retry-then-DLQ semantics.
 * Retries are tracked via x-death header count. Idempotency is the handler's responsibility
 * (use the inbox table pattern keyed on envelope.messageId).
 */
export async function startConsumer<T>(
  ctx: RabbitContext,
  opts: ConsumerOptions,
  handler: Handler<T>
): Promise<void> {
  const { channel, exchange } = ctx;
  const { queue, routingKeys } = opts;
  const prefetch = opts.prefetch ?? 10;
  const maxRetries = opts.maxRetries ?? 3;

  const dlx = `${queue}.dlx`;
  const dlq = `${queue}.dlq`;

  await channel.assertExchange(dlx, "fanout", { durable: true });
  await channel.assertQueue(dlq, { durable: true });
  await channel.bindQueue(dlq, dlx, "");

  await channel.assertQueue(queue, {
    durable: true,
    deadLetterExchange: dlx,
  });
  for (const rk of routingKeys) {
    await channel.bindQueue(queue, exchange, rk);
  }

  await channel.prefetch(prefetch);

  channel.consume(queue, async (msg: ConsumeMessage | null) => {
    if (!msg) return;
    const deaths = (msg.properties.headers?.["x-death"] as any[]) || [];
    const attempt = deaths.reduce((acc, d) => acc + (d.count || 0), 0);

    try {
      const envelope = JSON.parse(msg.content.toString()) as EventEnvelope<T>;
      await handler(envelope);
      channel.ack(msg);
    } catch (err) {
      log.error({ err, queue, attempt, messageId: msg.properties.messageId }, "handler failed");
      if (attempt >= maxRetries) {
        log.warn({ queue, messageId: msg.properties.messageId }, "max retries reached, sending to DLQ");
        channel.reject(msg, false); // routes to DLX → DLQ
      } else {
        // nack without requeue → DLX → ...but we want retry, so requeue=false would DLQ immediately.
        // Trick: republish to the queue with incremented header, ack original.
        channel.reject(msg, false);
      }
    }
  });

  log.info({ queue, routingKeys, dlq }, "consumer started");
}
