import { OrderRepository } from "../repository/order.repository";
import { OrderStatus } from "../models/types";
import { logger } from "../utils/logger";

const STUCK_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour SLA before a PENDING order is considered lost

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
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const stuck = await this.orders.findStuckPending(cutoff);

    for (const o of stuck) {
      o.status = OrderStatus.FAILED;
      o.failureReason = `reconciliation ${forDate}: no broker confirmation within SLA`;
      await this.orders.save(o);
    }

    logger.info({ forDate, failed: stuck.length }, "reconciliation complete");
    return { failed: stuck.length };
  }
}
