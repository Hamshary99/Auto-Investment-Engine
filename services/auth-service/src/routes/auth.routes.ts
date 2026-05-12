import { Router } from "express";
import { buildAuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/jwt.middleware";
import { AuthService } from "../services/auth.service";

export const buildAuthRouter = (auth: AuthService) => {
  const r = Router();
  const c = buildAuthController(auth);
  r.post("/register", c.register);
  r.post("/login", c.login);
  r.get("/me", requireAuth, c.me);
  return r;
};
