import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import type { Logger } from "@auto-invest/shared";
import { logger } from "../utils/logger";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
    log: Logger;
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  req.id = incoming && /^[\w-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  req.log = logger.child({ reqId: req.id, method: req.method, url: req.originalUrl });
  res.setHeader("x-request-id", req.id);

  const start = process.hrtime.bigint();
  req.log.info("request received");

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const meta = { status: res.statusCode, durationMs: Math.round(durationMs * 100) / 100 };
    if (res.statusCode >= 500) req.log.error(meta, "request failed");
    else if (res.statusCode >= 400) req.log.warn(meta, "request rejected");
    else req.log.info(meta, "request completed");
  });

  next();
}
