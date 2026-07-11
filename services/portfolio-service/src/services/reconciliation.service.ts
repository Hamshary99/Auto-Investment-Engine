import { OrderRepository } from "../repository/order.repository";
import { OrderStatus } from "../models/types";
import { logger } from "../utils/logger";
import { config } from "../config";


/**
 * Midnight reconciliation. Any order PENDING longer than the SLA is treated
 * as broker-side lost and flipped to FAILED so the user can re-place.
 *
 * In a real broker integration this would cross-check the broker's order
 * status API and may instead transition PENDING → EXECUTED for confirmed fills.
 */

export class ReconciliationService {
  constructor(private readonly orders: OrderRepository) {}

  async runForDate(forDate: string): Promise<{ failed: number }> {
    const BATCH_SIZE = 500;
    let totalFailed = 0;
    
    const cutoff = new Date(Date.now() - config.reconciliation.pendingOrderStuckThresholdMs);

    while(true) {
      const stuckBatch = await this.orders.findStuckPendingWithLimit(cutoff, BATCH_SIZE);

      if (stuckBatch.length === 0) break;

      for(const o of stuckBatch) {
        o.status = OrderStatus.FAILED;
        o.failureReason = `System reconciliation for ${forDate}: Order stuck in PENDING state for too long.`
      }

      await this.orders.saveAll(stuckBatch);
      totalFailed += stuckBatch.length;
    }

    logger.info({ forDate, failed: totalFailed }, "reconciliation complete");
    return { failed: totalFailed };
  }
}
