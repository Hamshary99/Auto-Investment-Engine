import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { UnauthorizedError } from "@auto-invest/shared";

export interface AuthedRequest extends Request {
  userId?: string;
  email?: string;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(new UnauthorizedError("missing bearer token"));
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { sub: string; email: string };
    req.userId = decoded.sub;
    req.email = decoded.email;
    next();
  } catch {
    next(new UnauthorizedError("invalid token"));
  }
}
