import { Router } from "express";
import { buildPortfolioController } from "../controllers/portfolio.controller";
import { requireAuth } from "../middleware/jwt.middleware";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import { NavService } from "../services/nav.service";

export const buildPortfolioRouter = (portfolios: PortfolioRepository, nav: NavService) => {
  const r = Router();
  const c = buildPortfolioController(portfolios, nav);
  r.get("/portfolio", requireAuth, c.get);
  r.get("/nav", requireAuth, c.nav);
  return r;
};
