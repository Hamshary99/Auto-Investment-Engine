import { AppDataSource } from "../data-source";
import { OrderService } from "../services/order.service";
import { ProcessedMessageRepository } from "../repositories/processed-message.repository";
import {
  EventEnvelope,
  OrderCreatedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
  createLogger,
} from "@auto-invest/shared";

const log = createLogger("order-exec-consumer");

export async function startOrderExecutionConsumer(
  ctx: RabbitContext,
  orders: OrderService,
  inbox: ProcessedMessageRepository
) {
  await startConsumer<OrderCreatedPayload>(
    ctx,
    {
      queue: "portfolio.order-execution",
      routingKeys: [ROUTING_KEYS.ORDER_CREATED],
      prefetch: parseInt(process.env.CONSUMER_PREFETCH || "10", 10),
      maxRetries: parseInt(process.env.CONSUMER_MAX_RETRIES || "3", 10),
    },
    async (env: EventEnvelope<OrderCreatedPayload>) => {
      await AppDataSource.transaction(async (tx) => {
        const firstTime = await inbox.markProcessed(env.messageId, env.type, tx);
        if (!firstTime) { log.info({ messageId: env.messageId }, "duplicate, skipping"); return; }
        const fillPrice = env.payload.priceHint ?? mockMarketPrice(env.payload.symbol);
        await orders.executeOrderTx(tx, env.payload.orderId, fillPrice);
      });
    }
  );
}

function mockMarketPrice(symbol: string): number {
  const seed = [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0);
  return 50 + (seed % 450);
}
