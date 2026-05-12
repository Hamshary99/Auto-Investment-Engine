import { OrderRepository } from "../repositories/order.repository";
import { createLogger } from "@auto-invest/shared";

const log = createLogger("reconciliation");

/**
 * Midnight reconciliation: any order PENDING for >1h is considered stuck
 * (broker never confirmed). Flip to FAILED with a clear reason so the user
 * can re-place. In a real broker integration, you'd cross-check the broker's
 * order status API and either complete or fail based on truth.
 */
export class ReconciliationService {
  constructor(private readonly orders: OrderRepository) {}

  async runForDate(forDate: string): Promise<{ failed: number }> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const stuck = await this.orders.findStuckPending(cutoff);
    for (const o of stuck) {
      o.status = "FAILED";
      o.failureReason = `reconciliation ${forDate}: no broker confirmation within SLA`;
      await this.orders.save(o);
    }
    log.info({ forDate, failed: stuck.length }, "reconciliation complete");
    return { failed: stuck.length };
  }
}
