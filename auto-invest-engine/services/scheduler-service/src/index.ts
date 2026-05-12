import cron from "node-cron";
import { config } from "./config";
import { runNavSnapshotJob } from "./jobs/nav-snapshot.job";
import { runReconciliationJob } from "./jobs/reconciliation.job";
import { runOrderSweepJob } from "./jobs/order-sweep.job";
import { connectRabbit, createLogger, Publisher } from "@auto-invest/shared";

const log = createLogger("scheduler-service");

async function main() {
  const rabbit = await connectRabbit(config.rabbit.url, config.rabbit.exchange);
  const publisher = new Publisher(rabbit);

  cron.schedule(config.cron.navSnapshot, () => safe("nav", () => runNavSnapshotJob(publisher)));
  cron.schedule(config.cron.reconciliation, () => safe("recon", () => runReconciliationJob(publisher)));
  cron.schedule(config.cron.orderSweep, () => safe("sweep", () => runOrderSweepJob(publisher)));

  log.info({ ...config.cron }, "scheduler-service started");
}

async function safe(name: string, fn: () => Promise<void>) {
  try { await fn(); } catch (err) { log.error({ err, name }, "job failed"); }
}

main().catch((err) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
