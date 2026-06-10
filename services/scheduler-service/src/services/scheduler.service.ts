import { Publisher, ROUTING_KEYS } from "@auto-invest/shared";
import { logger } from "../utils/logger";

/**
 * Cron-driven event source. Each method publishes one event onto the bus;
 * portfolio-service's consumers do the actual work. We never run the work
 * here — the scheduler is intentionally dumb so failures don't propagate.
 */
export class SchedulerService {
  constructor(private readonly publisher: Publisher) {}

  /** Daily, after market close — snapshot every portfolio's NAV. */
  async requestNavSnapshot(): Promise<void> {
    const forDate = todayUtc();
    await this.publisher.publish(ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED, { forDate });
    logger.info({ forDate }, "nav snapshot requested");
  }

  /** Midnight — fail any orders that have been PENDING past the SLA. */
  async requestReconciliation(): Promise<void> {
    const forDate = todayUtc();
    await this.publisher.publish(ROUTING_KEYS.RECONCILIATION_REQUESTED, { forDate });
    logger.info({ forDate }, "reconciliation requested");
  }

  /** Periodic — sweep stale PENDING orders (a more aggressive recon). */
  async requestOrderSweep(): Promise<void> {
    await this.publisher.publish(ROUTING_KEYS.ORDER_SWEEP_REQUESTED, { olderThanSeconds: 300 });
    logger.info("order sweep requested");
  }

  /** Periodic — broadcast auto-invest trigger for all enabled plans */
  async requestAutoInvest(): Promise<void> {
    await this.publisher.publish(ROUTING_KEYS.AUTO_INVEST_REQUESTED, { triggeredBy: "cron" as const });
    logger.info("auto invest requested");
  }

  /** Periodic (dev-only) — trigger market price random walk for all tracked symbols */
  async requestMarketTick(): Promise<void> {
    await this.publisher.publish(ROUTING_KEYS.MARKET_TICK_REQUESTED, { triggeredBy: "cron" as const });
    logger.info("market tick requested");
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

