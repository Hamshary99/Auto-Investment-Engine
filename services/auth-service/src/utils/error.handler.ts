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
 * request pipeline into a consistent JSON shape.
 */
export const handleError = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      status: "error",
      type: err.type,
      message: err.message,
      statusCode: err.statusCode,
      details: err.details,
    });
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({
    status: "error",
    type: "internal_error",
    message: "internal server error",
    statusCode: 500,
  });
};
