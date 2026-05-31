import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { verifyUserJwt, injectInternalAuth, verifyAdminJwt } from "./auth";
import { createLogger } from "@auto-invest/shared";

const log = createLogger("app-service");

export const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authProxy = createProxyMiddleware({
  target: config.authUpstream,
  changeOrigin: true,
  pathRewrite: { "^/auth": "" },
  xfwd: true,
});

export const portfolioProxy = createProxyMiddleware({
  target: config.portfolioUpstream,
  changeOrigin: true,
  pathRewrite: { "^/api": "" },
  xfwd: true,
});

export const authRoutingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip JWT verification for public routes
  if (req.path === "/login" || req.path === "/register") {
    return next();
  }
  
  // Protected routes require JWT
  verifyUserJwt(req, res, (err) => {
    if (err) return next(err);
    injectInternalAuth(req, res, next);
  });
};

export const adminProxy = createProxyMiddleware({
  target: config.adminUpstream,
  changeOrigin: true,
  xfwd: true,
});

export const adminRoutingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/auth/login" || req.path === "/auth/register") {
    return next();
  }
  verifyAdminJwt(req as any, res, next);
};

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message === "origin_not_allowed") {
    return res.status(403).json({ error: "cors_origin_not_allowed" });
  }
  log.error({ err }, "app-service error");
  res.status(500).json({ error: "internal_error" });
};
