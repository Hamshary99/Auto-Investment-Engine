import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import { AuthedRequest } from "../middleware/auth.middleware";

export const buildAuthController = (auth: AuthService) => ({
  postRegister: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await auth.register(email, password);
      res.status(201).json(result);
    } catch (e) { next(e); }
  },

  postLogin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await auth.login(email, password);
      res.json(result);
    } catch (e) { next(e); }
  },

  postVerifyEmail: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.body;
      const result = await auth.verifyEmail(token);
      res.json(result);
    } catch (e) { next(e); }
  },

  postResendVerification: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      const result = await auth.resendVerification(email);
      res.json(result);
    } catch (e) { next(e); }
  },

  getMe: (req: AuthedRequest, res: Response) => {
    res.json({ id: req.userId, email: req.email });
  },
});
