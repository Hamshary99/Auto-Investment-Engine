import { Publisher, ROUTING_KEYS, createLogger } from "@auto-invest/shared";

const log = createLogger("recon-job");

export async function runReconciliationJob(publisher: Publisher) {
  const forDate = new Date().toISOString().slice(0, 10);
  await publisher.publish(ROUTING_KEYS.RECONCILIATION_REQUESTED, { forDate });
  log.info({ forDate }, "reconciliation requested");
}
