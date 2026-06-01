import { Router } from "express";
import { ProductTypeController } from "../controllers/product-type.controller";
import { requireAdminAuth } from "../middleware/admin-auth.middleware";

export function buildProductTypeRouter(productTypeController: ProductTypeController): Router {
  const router = Router();

  // All product-type routes require admin authentication
  router.use("/product-types", requireAdminAuth);

  router.post("/product-types", productTypeController.createProductType);
  router.put("/product-types/:id", productTypeController.updateProductType);
  router.patch("/product-types/:id/deactivate", productTypeController.deactivateProductType);
  // router.put("/product-types/:id/associated-index-funds", productTypeController.updateAssociatedIndexFunds);

  return router;
}
