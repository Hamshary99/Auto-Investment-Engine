import { Router } from "express";
import { buildPortfolioController } from "../controllers/portfolio.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { PortfolioRepository } from "../repository/portfolio.repository";
import { NavService } from "../services/nav.service";

export const buildPortfolioRouter = (portfolios: PortfolioRepository, nav: NavService) => {
  const router = Router();
  const c = buildPortfolioController(portfolios, nav);

  router.get("/portfolio", requireAuth, c.getPortfolio);
  router.get("/nav",       requireAuth, c.getNav);

  return router;
};
