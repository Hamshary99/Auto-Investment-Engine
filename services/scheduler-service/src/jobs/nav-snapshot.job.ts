import { Publisher, ROUTING_KEYS, createLogger } from "@auto-invest/shared";

const log = createLogger("nav-job");

export async function runNavSnapshotJob(publisher: Publisher) {
  const forDate = new Date().toISOString().slice(0, 10);
  await publisher.publish(ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED, { forDate });
  log.info({ forDate }, "nav snapshot requested");
}
