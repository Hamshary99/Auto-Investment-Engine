import {
  EventEnvelope,
  AutoInvestRequestedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
} from "@auto-invest/shared";
import { ProcessedMessageRepository } from "../repository/processed-message.repository";
import { SubscribedPortfolioService } from "../services/subscribed-portfolio.service";
import { AutoInvestPlanRepository, UserPortfolioRepository } from "../repository/index";
import { logger } from "../utils/logger";
import { Decimal } from "decimal.js";

/**
 * Broadcast consumer — the scheduler publishes a single "auto.invest.requested"
 * event every cron tick. This consumer fetches ALL plans with autoInvest = true,
 * then delegates each slice to the service layer (addFund) which owns the
 * reservePct guard and order placement logic.
 *
 * Separation of concerns:
 *   • Scheduler:  fires event on a timer (knows nothing about plans or cash)
 *   • Consumer:   orchestrates (loads plans → calculates slices → delegates)
 *   • addFund:    validates investable limits (reservePct), places orders
 */
import { OrderRepository } from "../repository/order.repository";

export async function startAutoInvestConsumer(
  ctx: RabbitContext,
  portfolioService: SubscribedPortfolioService,
  planRepo: AutoInvestPlanRepository,
  inbox: ProcessedMessageRepository,
  orderRepo: OrderRepository,
) {
  await startConsumer<AutoInvestRequestedPayload>(
    ctx,
    { queue: "portfolio.auto-invest", routingKeys: [ROUTING_KEYS.AUTO_INVEST_REQUESTED] },
    async (env: EventEnvelope<AutoInvestRequestedPayload>) => {
      const firstTime = await inbox.markProcessed(env.messageId, env.type);
      if (!firstTime) {
        logger.info({ messageId: env.messageId }, "duplicate auto.invest.requested, skipping");
        return;
      }

      // ── Broadcast: fetch ALL enabled plans ──────────────────────────
      const plans = await planRepo.findAutoInvestEnabled();
      if (!plans.length) {
        logger.info("no auto-invest plans enabled, nothing to do");
        return;
      }

      let invested = 0;
      let skipped = 0;

      for (const plan of plans) {
        const allocations = plan.allocations || [];
        if (!allocations.length) {
          logger.info({ planId: plan.id }, "plan has no allocations, skipping");
          skipped++;
          continue;
        }

        // ── Pending Orders Check ─────────────────────────────────────
        // Skip this plan if it still has pending orders.
        // This prevents double-spending cash before previous orders settle.
        const hasPending = await orderRepo.hasPendingOrdersForPlan(plan.id);
        if (hasPending) {
          logger.info({ planId: plan.id }, "plan has pending orders, skipping to avoid double spend");
          skipped++;
          continue;
        }

        // ── Cash check — quick exit if plan has no cash ──────────────
        // Cash is purely investable now. The reserve is safely kept in plan.reservedCash.
        const cash = new Decimal(plan.cashBalance);
        if (cash.lte(0)) {
          skipped++;
          continue;
        }

        // ── Sweep dust to reserve ─────────────────────────────────────
        // If the remaining investable cash is under $10, we don't want to place
        // micro-orders. We sweep this "dust" into the reservedCash bucket.
        if (cash.lt(10)) {
          plan.reservedCash = new Decimal(plan.reservedCash || "0").plus(cash).toFixed(2);
          plan.cashBalance = "0.00";
          await planRepo.save(plan);
          logger.info({ planId: plan.id, swept: cash.toFixed(2) }, "swept dust cash into reserve");
          skipped++;
          continue;
        }

        const investable = cash;
        logger.info({ planId: plan.id, investable: investable.toFixed(2) }, "auto invest cycle complete");

        // ── Execute Aggregated Investment ────────────────────────────
        try {
          await portfolioService.executePlanInvestment(plan, investable);
          invested++;
        } catch (err: any) {
          logger.error(
            { planId: plan.id, err: err.message },
            "failed to execute plan investment",
          );
        }

        logger.info({ planId: plan.id, investable: investable.toFixed(2) }, "auto invest cycle complete");
      }

      logger.info(
        { total: plans.length, invested, skipped, triggeredBy: env.payload.triggeredBy ?? "cron" },
        "auto invest batch complete",
      );
    },
  );
}
