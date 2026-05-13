import { Router } from "express";
import { buildAuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { RegisterUserDto } from "../dto/register-user.dto";
import { LoginUserDto } from "../dto/login-user.dto";
import { VerifyEmailDto } from "../dto/verify-email.dto";
import { ResendVerificationDto } from "../dto/resend-verification.dto";
import { AuthService } from "../services/auth.service";

export const buildAuthRouter = (auth: AuthService) => {
  const router = Router();
  const c = buildAuthController(auth);

  router.post("/register",              validate(RegisterUserDto),       c.postRegister);
  router.post("/login",                 validate(LoginUserDto),          c.postLogin);
  router.post("/verify",                validate(VerifyEmailDto),        c.postVerifyEmail);
  router.post("/resend-verification",   validate(ResendVerificationDto), c.postResendVerification);
  router.get("/me",                     requireAuth,                     c.getMe);

  return router;
};
