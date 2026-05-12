import { NextFunction, Response } from "express";
import { AuthedRequest } from "../middleware/jwt.middleware";
import { OrderService } from "../services/order.service";

export const buildOrdersController = (orders: OrderService) => ({
  async create(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const o = await orders.createOrder(req.userId!, req.body);
      res.status(202).json(o);
    } catch (e) { next(e); }
  },
  async get(req: AuthedRequest, res: Response, next: NextFunction) {
    try {
      const o = await orders.findById(req.userId!, req.params.id);
      res.json(o);
    } catch (e) { next(e); }
  },
});
