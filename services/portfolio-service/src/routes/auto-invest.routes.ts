import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth.middleware";
import { Publisher, ROUTING_KEYS } from "@auto-invest/shared";
import { logger } from "../utils/logger";
import { QuizService, InvestmentPlanService } from "../services";
import { UserPortfolioRepository } from "../repository";
import Decimal from "decimal.js";

/**
 * ── Manual Auto-Invest Trigger ──────────────────────────────────────────
 *
 * DEBUG / TESTING ONLY — This endpoint publishes an AUTO_INVEST_REQUESTED
 * event manually, bypassing the cron timer. Useful for:
 *   • Postman / curl testing without waiting for the cron tick
 *   • Verifying the consumer pipeline end-to-end
 *   • Demos
 *
 * The event follows the exact same path as a cron-triggered one:
 *   POST /auto-invest/run  →  publisher  →  RabbitMQ  →  consumer
 *
 * NOTE: The response returns immediately after publishing. The actual
 * investment happens asynchronously in the consumer. Check logs or
 * query holdings/orders to see the results.
 */
export const buildAutoInvestRouter = (
  publisher: Publisher,
  quizService: QuizService,
  investmentPlanService: InvestmentPlanService,
  userPortfolioRepo: UserPortfolioRepository
) => {
  const router = Router();

  router.post("/auto-invest/run", requireAuth, async (_req, res, next) => {
    try {
      await publisher.publish(ROUTING_KEYS.AUTO_INVEST_REQUESTED, {
        triggeredBy: "manual" as const,
      });
      logger.info("manual auto-invest triggered");
      res.json({
        message: "Auto-invest event published. Check logs for results.",
        note: "This is async — the consumer will process it shortly.",
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/auto-invest/full-flow", requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { answers, depositAmount } = req.body;
      const userId = req.userId!;

      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: "Please provide an array of answers" });
      }

      if (!depositAmount || typeof depositAmount !== 'number' || depositAmount <= 0 || depositAmount % 100 !== 0) {
        return res.status(400).json({ error: "depositAmount is required and must be a positive number divisible by 100" });
      }

      // 1. Calculate Score and Risk Profile
      const totalScore = await quizService.quizScore(answers);
      const riskProfile = quizService.calculateRiskProfile(totalScore, answers.length);

      // 2. Create / Update the Plan
      const plan = await investmentPlanService.createPlanFromRiskProfile({
        userId,
        riskProfile,
        reservePct: 0.01,
        autoInvest: true
      });

      // 3. Mock Deposit
      let portfolio = await userPortfolioRepo.findByUserId(userId);
      if (!portfolio) {
        portfolio = await userPortfolioRepo.create({ userId, cashBalance: depositAmount.toString() });
      } else {
        portfolio.cashBalance = new Decimal(portfolio.cashBalance).plus(depositAmount).toString();
        portfolio = await userPortfolioRepo.save(portfolio);
      }
      
      // Transfer cash from user's main wallet to the plan's sub-balance
      await investmentPlanService.fundPlan(plan.id, userId, depositAmount);

      // 4. Trigger Auto-Invest Consumer
      await publisher.publish(ROUTING_KEYS.AUTO_INVEST_REQUESTED, {
        triggeredBy: "full-flow" as const,
        userId // Can target specific user or remove to target all
      });

      logger.info({ userId, riskProfile, cashAdded: depositAmount }, "full-flow auto-invest triggered");

      res.json({
        message: "Success! Plan created, cash deposited, and auto-invest triggered. Wait a second and check holdings.",
        riskProfile,
        planId: plan.id,
        newCashBalance: portfolio.cashBalance
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
};
