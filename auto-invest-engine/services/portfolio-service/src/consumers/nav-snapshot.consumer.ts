import { NavService } from "../services/nav.service";
import { ProcessedMessageRepository } from "../repository/processed-message.repository";
import { logger } from "../utils/logger";
import {
  EventEnvelope,
  NavSnapshotRequestedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
} from "@auto-invest/shared";

export async function startNavSnapshotConsumer(
  ctx: RabbitContext,
  nav: NavService,
  inbox: ProcessedMessageRepository
) {
  await startConsumer<NavSnapshotRequestedPayload>(
    ctx,
    { queue: "portfolio.nav-snapshot", routingKeys: [ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED] },
    async (env: EventEnvelope<NavSnapshotRequestedPayload>) => {
      const firstTime = await inbox.markProcessed(env.messageId, env.type);
      if (!firstTime) {
        logger.info({ messageId: env.messageId }, "duplicate nav.snapshot.requested, skipping");
        return;
      }
      const count = await nav.snapshotAll(env.payload.forDate);
      logger.info({ forDate: env.payload.forDate, count }, "nav snapshot complete");
    }
  );
}
