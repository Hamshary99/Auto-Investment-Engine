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

  depositCash: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const { amount } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({ error: "Valid positive amount is required" });
        return;
      }
      
      let p = await userPortfolios.findByUserId(req.userId!);
      if (!p) {
        p = await userPortfolios.create({ userId: req.userId!, cashBalance: amount.toString() });
      } else {
        const Decimal = require("decimal.js").Decimal;
        p.cashBalance = new Decimal(p.cashBalance).plus(amount).toString();
        p = await userPortfolios.save(p);
      }
      
      res.json({ deposited: amount, newBalance: p.cashBalance });
    } catch (e) {
      next(e);
    }
  },
});
