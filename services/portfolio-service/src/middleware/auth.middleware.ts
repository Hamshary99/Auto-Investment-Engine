import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { ApiError } from "../utils/error.handler";

export interface AuthedRequest extends Request {
  userId?: string;
  email?: string;
}

/**
 * Verifies the Bearer JWT issued by auth-service. app-service is a transparent
 * proxy that just forwards the Authorization header.
 */
export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new ApiError("missing bearer token", 401, "unauthorized"));
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; email?: string };
    req.userId = decoded.sub;
    req.email = decoded.email;
    next();
  } catch {
    next(new ApiError("invalid token", 401, "unauthorized"));
  }
}
