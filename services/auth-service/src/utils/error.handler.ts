import { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

/**
 * Single error type the service throws. statusCode → HTTP status,
 * type → machine-readable category, details → optional structured info.
 */
export class ApiError extends Error {
  statusCode: number;
  type: string;
  details: unknown;

  constructor(message: string, statusCode = 500, type = "api_error", details: unknown = null) {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
    this.details = details;
  }
}

/**
 * Express error middleware. Converts any error thrown anywhere in the
 * request pipeline into a consistent JSON shape and logs it with the
 * per-request logger so the stack trace is preserved.
 */
export const handleError = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  const log = req.log ?? logger;

  if (err instanceof ApiError) {
    log.warn(
      { err, statusCode: err.statusCode, type: err.type, details: err.details },
      "api error",
    );
    return res.status(err.statusCode).json({
      status: "error",
      type: err.type,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
  }

  log.error({ err }, "unhandled error");
  res.status(500).json({
    status: "error",
    type: "internal_error",
    message: "internal server error",
    statusCode: 500,
  });
};
