import { NextFunction, Response } from "express";
import { UserPortfolioRepository } from "../repository/user-portfolio.repository";
import { NavService } from "../services/nav.service";
import { AuthedRequest } from "../middleware/auth.middleware";

export const buildUserPortfolioController = (
  userPortfolios: UserPortfolioRepository,
  nav: NavService,
) => ({
  getUserPortfolio: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const p = await userPortfolios.findByUserIdWithHoldings(req.userId!);
      res.json(p ?? { userId: req.userId, cashBalance: "0", holdings: [] });
    } catch (e) {
      next(e);
    }
  },

  getNav: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const snap = await nav.latestForUser(req.userId!);
      res.json(snap ?? null);
    } catch (e) {
      next(e);
    }
  },
});
