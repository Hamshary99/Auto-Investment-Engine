import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

import cron from "node-cron";
import { connectRabbit, Publisher } from "@auto-invest/shared";
import { config } from "./config";
import { SchedulerService } from "./services/scheduler.service";
import { logger } from "./utils/logger";

async function main() {
  // rabbit
  const rabbit = await connectRabbit(config.rabbit.url, config.rabbit.exchange);
  const publisher = new Publisher(rabbit);

  // composition root
  const scheduler = new SchedulerService(publisher);

  // cron — every tick wraps the job in safe() so a failure doesn't kill the cron
  cron.schedule(config.cron.navSnapshot,    () => safe("nav-snapshot",    () => scheduler.requestNavSnapshot()));
  cron.schedule(config.cron.reconciliation, () => safe("reconciliation", () => scheduler.requestReconciliation()));
  cron.schedule(config.cron.orderSweep,     () => safe("order-sweep",    () => scheduler.requestOrderSweep()));
  cron.schedule(config.cron.autoInvest,     () => safe("auto-invest",    () => scheduler.requestAutoInvest()));
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "dev") {
    cron.schedule(config.cron.marketTick, () => safe("market-tick", () => scheduler.requestMarketTick()));
    logger.info("Market tick simulator enabled for development");
  } else {
    logger.info("Market tick simulator disabled (production mode expects real API feeds)");
  }

  logger.info({ ...config.cron }, "scheduler-service started");
}

async function safe(name: string, fn: () => Promise<void>) {
  try { await fn(); }
  catch (err) { logger.error({ err, job: name }, "job failed"); }
}

process.on("uncaughtException", (err) => { logger.error({ err }, "uncaughtException"); process.exit(1); });
process.on("unhandledRejection", (err) => { logger.error({ err }, "unhandledRejection"); process.exit(1); });

main().catch((err) => { logger.error({ err }, "fatal"); process.exit(1); });
