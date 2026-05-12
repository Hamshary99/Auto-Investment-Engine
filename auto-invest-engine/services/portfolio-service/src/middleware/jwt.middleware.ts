import crypto from "crypto";
import { NextFunction, Request, Response } from "express";
import { config } from "../config";
import { UnauthorizedError } from "@auto-invest/shared";

export interface AuthedRequest extends Request {
  userId?: string;
  email?: string;
}

function verifyInternalToken(token: string): { sub: string; email?: string; iat: number } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", config.internalSecret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload.iat !== "number") return null;
    if (Date.now() - payload.iat > config.internalTokenTtlMs) return null;
    if (typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const internal = req.header("x-internal-auth");
  if (!internal) return next(new UnauthorizedError("app-service authentication required"));
  const payload = verifyInternalToken(internal);
  if (!payload) return next(new UnauthorizedError("invalid app-service token"));
  req.userId = payload.sub;
  req.email = payload.email;
  next();
}
