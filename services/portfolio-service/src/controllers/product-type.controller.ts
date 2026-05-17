import { NextFunction, Response } from "express";
import { AuthedRequest } from "../middleware/auth.middleware";
import { SubscribedPortfolioService } from "../services/index";

export const buildProductTypeController = (service: SubscribedPortfolioService) => ({
  listProductTypes: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const types = await service.listActiveProductTypes();
      res.json(types);
    } catch (e) {
      next(e);
    }
  },

  getProductType: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const pt = await service.getActiveProductTypeOrThrow(String(req.params.id));
      res.json(pt);
    } catch (e) {
      next(e);
    }
  },

  addFund: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const productTypeId = String(req.params.id);
      const amount = Number(req.body.amount);
      const orders = await service.addFund(req.userId!, productTypeId, amount);
      res.status(202).json(orders);
    } catch (e) {
      next(e);
    }
  },

  redeem: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const productTypeId = String(req.params.id);
      const amount = Number(req.body.amount);
      const orders = await service.redeem(req.userId!, productTypeId, amount);
      res.status(202).json(orders);
    } catch (e) {
      next(e);
    }
  },
});
