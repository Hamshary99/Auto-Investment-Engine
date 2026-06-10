import { AppDataSource } from "../data-source";
import { OrderService } from "../services/order.service";
import { MarketDataService } from "../services/market-data.service";
import { ProcessedMessageRepository } from "../repository/processed-message.repository";
import { config } from "../config";
import { logger } from "../utils/logger";
import {
  EventEnvelope,
  OrderCreatedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
} from "@auto-invest/shared";

/**
 * Consumes `order.created` events and runs the fill within a single Postgres
 * transaction:
 *   1. Insert messageId into the inbox  → idempotency guard (PK violation = duplicate)
 *   2. OrderService.executeOrderTx      → state machine + holdings/cash updates
 * If anything throws, the whole tx rolls back, including the inbox row, so a
 * retry can re-process the message.
 *
 * Fill prices come from MarketDataService (dynamic, risk-weighted random walk)
 * when no priceHint is provided in the event payload.
 */
export async function startOrderExecutionConsumer(
  ctx: RabbitContext,
  orders: OrderService,
  marketData: MarketDataService,
  inbox: ProcessedMessageRepository
) {
  await startConsumer<OrderCreatedPayload>(
    ctx,
    {
      queue: "portfolio.order-execution",
      routingKeys: [ROUTING_KEYS.ORDER_CREATED],
      prefetch: config.rabbit.prefetch,
      maxRetries: config.rabbit.maxRetries,
    },
    async (env: EventEnvelope<OrderCreatedPayload>) => {
      await AppDataSource.transaction(async (tx) => {
        const firstTime = await inbox.markProcessed(env.messageId, env.type, tx);
        if (!firstTime) {
          logger.info({ messageId: env.messageId }, "duplicate order.created, skipping");
          return;
        }
        const fillPrice = env.payload.priceHint ?? marketData.getPrice(env.payload.symbol);
        await orders.executeOrderTx(tx, env.payload.orderId, fillPrice);
      });
    }
  );
}

