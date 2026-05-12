import "reflect-metadata";
import express, { NextFunction, Request, Response } from "express";
import { AppDataSource } from "./data-source";
import { buildAuthRouter } from "./routes/auth.routes";
import { config } from "./config";
import { UserRepository } from "./repositories/user.repository";
import { AuthService } from "./services/auth.service";
import { AppError, createLogger } from "@auto-invest/shared";

const log = createLogger("auth-service");

async function main() {
  await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS auth`).catch(() => {});
  await AppDataSource.initialize();
  log.info("db connected");

  const users = new UserRepository();
  const auth = new AuthService(users);

  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/", buildAuthRouter(auth));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    log.error({ err }, "unhandled");
    res.status(500).json({ error: "internal_error" });
  });

  app.listen(config.port, () => log.info({ port: config.port }, "auth-service listening"));
}

main().catch((err) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
