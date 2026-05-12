import { NavService } from "../services/nav.service";
import { ProcessedMessageRepository } from "../repositories/processed-message.repository";
import {
  EventEnvelope,
  NavSnapshotRequestedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
  createLogger,
} from "@auto-invest/shared";

const log = createLogger("nav-consumer");

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
      if (!firstTime) { log.info({ messageId: env.messageId }, "duplicate, skipping"); return; }
      const count = await nav.snapshotAll(env.payload.forDate);
      log.info({ forDate: env.payload.forDate, count }, "nav snapshot complete");
    }
  );
}
