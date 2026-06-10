import {
  EventEnvelope,
  MarketTickRequestedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
} from "@auto-invest/shared";
import { ProcessedMessageRepository } from "../repository/processed-message.repository";
import { MarketDataService } from "../services/market-data.service";
import { logger } from "../utils/logger";

/**
 * Consumes `market.tick.requested` events published by the scheduler
 * on a cron interval (default: every 5 minutes in dev).
 *
 * On each tick, applies a random walk to every tracked symbol's price
 * via MarketDataService.applyMarketTick(). The volatility of each
 * symbol is determined by the risk profile of its parent product type:
 *   - Conservative: ±2% per tick
 *   - Moderate:     ±5% per tick
 *   - Aggressive:   ±10% per tick
 *
 * This consumer is idempotent via the processed_messages inbox —
 * re-delivered messages are safely skipped.
 */
export async function startMarketTickConsumer(
  ctx: RabbitContext,
  marketData: MarketDataService,
  inbox: ProcessedMessageRepository,
) {
  await startConsumer<MarketTickRequestedPayload>(
    ctx,
    {
      queue: "portfolio.market-tick",
      routingKeys: [ROUTING_KEYS.MARKET_TICK_REQUESTED],
    },
    async (env: EventEnvelope<MarketTickRequestedPayload>) => {
      const firstTime = await inbox.markProcessed(env.messageId, env.type);
      if (!firstTime) {
        logger.info({ messageId: env.messageId }, "duplicate market.tick.requested, skipping");
        return;
      }

      const result = marketData.applyMarketTick();

      logger.info(
        {
          symbolCount: result.symbolCount,
          biggestGainer: result.biggestGainer,
          biggestLoser: result.biggestLoser,
          triggeredBy: env.payload.triggeredBy ?? "cron",
        },
        "market tick processed",
      );
    },
  );
}
