import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthedRequest } from "../middleware/jwt.middleware";

export const buildAuthController = (auth: AuthService) => ({
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body ?? {};
      const result = await auth.register(email, password);
      res.status(201).json(result);
    } catch (e) { next(e); }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body ?? {};
      const result = await auth.login(email, password);
      res.json(result);
    } catch (e) { next(e); }
  },

  async me(req: AuthedRequest, res: Response) {
    res.json({ id: req.userId, email: req.email });
  },
});
