import pino from "pino";

export const createLogger = (service: string) =>
  pino({
    name: service,
    level: process.env.LOG_LEVEL || "info",
    base: { service },
  });

export type Logger = ReturnType<typeof createLogger>;
