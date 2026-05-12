import { ReconciliationService } from "../services/reconciliation.service";
import { ProcessedMessageRepository } from "../repositories/processed-message.repository";
import {
  EventEnvelope,
  RabbitContext,
  ReconciliationRequestedPayload,
  ROUTING_KEYS,
  startConsumer,
  createLogger,
} from "@auto-invest/shared";

const log = createLogger("recon-consumer");

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
      if (!firstTime) { log.info({ messageId: env.messageId }, "duplicate, skipping"); return; }
      const res = await recon.runForDate(env.payload.forDate ?? new Date().toISOString().slice(0, 10));
      log.info({ ...res }, "reconciliation finished");
    }
  );
}
