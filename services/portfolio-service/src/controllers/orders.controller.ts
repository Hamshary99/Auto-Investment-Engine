import { NextFunction, Response } from "express";
import { AuthedRequest } from "../middleware/auth.middleware";
import { OrderService } from "../services/order.service";

export const buildOrdersController = (orders: OrderService) => ({
  postOrder: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const o = await orders.placeOrder(req.userId!, req.body);
      res.status(202).json(o);
    } catch (e) { next(e); }
  },

  getOrder: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const o = await orders.findOrderForUser(req.userId!, String(req.params.id));
      res.json(o);
    } catch (e) { next(e); }
  },

  getOrders: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const list = await orders.listOrdersForUser(req.userId!);
      res.json(list);
    } catch (e) { next(e); }
  },
});
