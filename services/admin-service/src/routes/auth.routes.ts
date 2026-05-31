import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";

export function buildAuthRouter(authController: AuthController): Router {
  const router = Router();

  router.post("/auth/login", authController.login);
  router.post("/auth/register", authController.register);

  return router;
}
