import { Router } from "express";
import { buildUserPortfolioController } from "../controllers/user-portfolio.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { UserPortfolioRepository } from "../repository/user-portfolio.repository";
import { NavService } from "../services/nav.service";

export const buildUserPortfolioRouter = (
  userPortfolios: UserPortfolioRepository,
  nav: NavService,
) => {
  const router = Router();
  const c = buildUserPortfolioController(userPortfolios, nav);

  router.get("/user-portfolio", requireAuth, c.getUserPortfolio);
  router.get("/nav", requireAuth, c.getNav);
  router.post("/deposits", requireAuth, c.depositCash);

  return router;
};
