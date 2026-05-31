import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config";
import { signInternalToken } from "./internal-token";

export interface AppRequest extends Request {
  userId?: string;
  email?: string;
  adminId?: string;
  adminRole?: string;
}

export function verifyUserJwt(req: AppRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing_bearer_token" });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; email?: string };
    req.userId = decoded.sub;
    req.email = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}

export function verifyAdminJwt(req: AppRequest, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "missing_bearer_token" });
  }
  try {
    // Matches AdminJwtPayload from admin-service
    const decoded = jwt.verify(token, config.adminJwtSecret) as { adminId: string; role: string };
    req.adminId = decoded.adminId;
    req.adminRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: "invalid_admin_token" });
  }
}

export function injectInternalAuth(req: AppRequest, _res: Response, next: NextFunction) {
  if (!req.userId) return next();
  const token = signInternalToken({ userId: req.userId, email: req.email }, config.internalSecret);
  req.headers["x-internal-auth"] = token;
  req.headers["x-user-id"] = req.userId;
  if (req.email) req.headers["x-user-email"] = req.email;
  next();
}

export function stripClientInternalHeaders(req: Request, _res: Response, next: NextFunction) {
  delete req.headers["x-internal-auth"];
  delete req.headers["x-user-id"];
  delete req.headers["x-user-email"];
  next();
}
