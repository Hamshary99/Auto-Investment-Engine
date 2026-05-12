import { Publisher, ROUTING_KEYS, createLogger } from "@auto-invest/shared";

const log = createLogger("sweep-job");

export async function runOrderSweepJob(publisher: Publisher) {
  await publisher.publish(ROUTING_KEYS.ORDER_SWEEP_REQUESTED, { olderThanSeconds: 300 });
  log.info("order sweep requested");
}
