import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { buildInvestmentPlanController } from "../controllers/investment-plan.controller";
import { InvestmentPlanService } from "../services/index";

export const buildInvestmentPlanRouter = (service: InvestmentPlanService) => {
  const router = Router();
  const c = buildInvestmentPlanController(service);

  router.get("/plan", requireAuth, c.listPlans);
  router.get("/plan/:id", requireAuth, c.getPlan);
  router.post("/plan/from-quiz", requireAuth, c.createFromQuiz);

  return router;
};
