import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { buildInvestmentPlanController } from "../controllers/investment-plan.controller";
import { InvestmentPlanService, SubscribedPortfolioService } from "../services/index";

export const buildInvestmentPlanRouter = (
  service: InvestmentPlanService,
  subscribedPortfolioService: SubscribedPortfolioService
) => {
  const router = Router();
  const c = buildInvestmentPlanController(service, subscribedPortfolioService);

  router.get("/plan", requireAuth, c.listPlans);
  router.get("/plan/:id", requireAuth, c.getPlan);
  router.post("/plan/from-quiz", requireAuth, c.createFromQuiz);

  router.put("/plan/:id/allocations", requireAuth, c.updatePlanAllocations);
  router.patch("/plan/:id", requireAuth, c.updatePlanPreferences);
  router.post("/plan/:id/fund", requireAuth, c.fundPlan);
  router.post("/plan/:id/withdraw", requireAuth, c.withdrawFromPlan);

  // TODO: create route method
  // router.post("/plan/:id/manual-allocate", requireAuth, c.manualAllocate);

  router.delete("/plan/:id", requireAuth, c.deletePlan);

  return router;
};
