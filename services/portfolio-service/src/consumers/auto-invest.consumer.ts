import {
  EventEnvelope,
  AutoInvestRequestedPayload,
  RabbitContext,
  ROUTING_KEYS,
  startConsumer,
} from "@auto-invest/shared";
import { ProcessedMessageRepository } from "../repository/processed-message.repository";
import { SubscribedPortfolioService } from "../services/subscribed-portfolio.service";
import { AutoInvestPlanRepository } from "../repository/index";
import { logger } from "../utils/logger";
import { Decimal } from "decimal.js";

export async function startAutoInvestConsumer(
  ctx: RabbitContext,
  portfolioService: SubscribedPortfolioService,
  planRepo: AutoInvestPlanRepository,
  inbox: ProcessedMessageRepository,
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

      const { planId, userId } = env.payload;
      const plan = await planRepo.findById(planId);
      if (!plan || plan.userId !== userId) {
        logger.warn({ planId }, "auto invest requested for unknown or mismatched plan");
        return;
      }

      if (!plan.autoInvest || new Decimal(plan.cashBalance).lte(0)) {
        logger.info({ planId }, "plan disabled or no cash, skipping");
        return;
      }

      const allocations = plan.allocations || [];
      if (!allocations.length) {
        logger.info({ planId }, "plan has no allocations, skipping");
        return;
      }

      const investable = new Decimal(plan.cashBalance).mul(1 - plan.reservePct);
      if (investable.lte(0.01)) {
        logger.info({ planId }, "no investable cash after reserve, skipping");
        return;
      }

      for (const alloc of allocations) {
        const slice = investable.mul(alloc.weight);
        if (slice.lte(0.01)) continue;

        try {
          await portfolioService.addFund(
            userId,
            alloc.productType.id,
            slice.toNumber(),
            plan.reservePct,
            planId,
          );
        } catch (err: any) {
          logger.error(
            { planId, productTypeId: alloc.productType.id, err: err.message },
            "failed to invest slice",
          );
        }
      }

      logger.info({ planId, investable: investable.toFixed(2) }, "auto invest cycle complete");
    },
  );
}
