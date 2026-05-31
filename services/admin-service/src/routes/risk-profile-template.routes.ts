import { Router } from "express";
import { RiskProfileTemplateController } from "../controllers/risk-profile-template.controller";
import { requireAdminAuth } from "../middleware/admin-auth.middleware";

export function buildRiskProfileTemplateRouter(controller: RiskProfileTemplateController): Router {
  const router = Router();

  router.use("/risk-profile-templates", requireAdminAuth);

  router.get("/risk-profile-templates/:riskProfile", controller.getTemplatesByProfile);
  router.put("/risk-profile-templates/:riskProfile", controller.updateTemplatesByProfile);

  return router;
}
