import { NextFunction, Response } from "express";
import { PortfolioRepository } from "../repositories/portfolio.repository";
import { NavService } from "../services/nav.service";
import { AuthedRequest } from "../middleware/jwt.middleware";

export const buildPortfolioController = (portfolios: PortfolioRepository, nav: NavService) => ({
  async get(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const p = await portfolios.findByUserIdWithHoldings(req.userId!);
      res.json(p ?? { userId: req.userId, cashBalance: "0", holdings: [] });
    } catch (e) { next(e); }
  },

  async nav(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const snap = await nav.latestForUser(req.userId!);
      res.json(snap ?? null);
    } catch (e) { next(e); }
  },
});
