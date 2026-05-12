import { ReconciliationService } from "../services/reconciliation.service";
import { ProcessedMessageRepository } from "../repository/processed-message.repository";
import { logger } from "../utils/logger";
import {
  EventEnvelope,
  RabbitContext,
  ReconciliationRequestedPayload,
  ROUTING_KEYS,
  startConsumer,
} from "@auto-invest/shared";

export async function startReconciliationConsumer(
  ctx: RabbitContext,
  recon: ReconciliationService,
  inbox: ProcessedMessageRepository
) {
  await startConsumer<ReconciliationRequestedPayload>(
    ctx,
    {
      queue: "portfolio.reconciliation",
      routingKeys: [ROUTING_KEYS.RECONCILIATION_REQUESTED, ROUTING_KEYS.ORDER_SWEEP_REQUESTED],
    },
    async (env: EventEnvelope<ReconciliationRequestedPayload>) => {
      const firstTime = await inbox.markProcessed(env.messageId, env.type);
      if (!firstTime) {
        logger.info({ messageId: env.messageId }, "duplicate reconciliation.requested, skipping");
        return;
      }
      const forDate = env.payload.forDate ?? new Date().toISOString().slice(0, 10);
      const res = await recon.runForDate(forDate);
      logger.info({ ...res }, "reconciliation finished");
    }
  );
}
