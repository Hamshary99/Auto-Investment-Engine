import { Router } from "express";
import { buildOrdersController } from "../controllers/orders.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { PlaceOrderDto } from "../dto/place-order.dto";
import { OrderService } from "../services/order.service";

export const buildOrdersRouter = (orders: OrderService) => {
  const router = Router();
  const c = buildOrdersController(orders);

  router.post("/orders",    requireAuth, validate(PlaceOrderDto), c.postOrder);
  router.get("/orders/:id", requireAuth,                          c.getOrder);

  return router;
};
