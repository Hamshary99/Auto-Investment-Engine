import { Router } from "express";
import { requireAuth } from "../middleware/jwt.middleware";
import { OrderService } from "../services/order.service";
import { buildOrdersController } from "../controllers/orders.controller";

export const buildOrdersRouter = (orders: OrderService) => {
  const r = Router();
  const c = buildOrdersController(orders);
  r.post("/orders", requireAuth, c.create);
  r.get("/orders/:id", requireAuth, c.get);
  return r;
};
