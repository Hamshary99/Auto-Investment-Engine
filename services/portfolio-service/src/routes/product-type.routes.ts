import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { buildProductTypeController } from "../controllers/index";
import { AddFundDto } from "../dto/add-fund.dto";
import { SubscribedPortfolioService } from "../services/index";

export const buildProductTypeRouter = (service: SubscribedPortfolioService) => {
  const router = Router();
  const c = buildProductTypeController(service);

  router.get("/product-types", requireAuth, c.listProductTypes);
  router.get("/product-types/:id", requireAuth, c.getProductType);
  router.post("/product-types/:id/add-fund", requireAuth, validate(AddFundDto), c.addFund);
  router.post("/product-types/:id/redeem", requireAuth, validate(AddFundDto), c.redeem);

  return router;
};
