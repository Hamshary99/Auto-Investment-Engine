import { NextFunction, Response } from "express";
import { AuthedRequest } from "../middleware/auth.middleware";
import { FundService } from "../services/index";

export const buildFundController = (fundService: FundService) => ({
  listFunds: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const funds = await fundService.listActiveFunds();
      res.json(funds);
    } catch (e) { next(e); }
  },

  getFund: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const fund = await fundService.getActiveOrThrow(String(req.params.id));
      res.json(fund);
    } catch (e) { next(e); }
  },

  investInFund: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const fundId = String(req.params.id);
      const amount = Number(req.body.amount);
      const orders = await fundService.invest(req.userId!, fundId, amount);
      res.status(202).json(orders);
    } catch (e) { next(e); }
  },

  withdrawFromFund: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const fundId = String(req.params.id);
      const amount = Number(req.body.amount);
      const orders = await fundService.withdraw(req.userId!, fundId, amount);
      res.status(202).json(orders);
    } catch (e) { next(e); }
  },
});
