import "reflect-metadata";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { AppDataSource } from "./data-source";
import { config } from "./config";
import { UserRepository } from "./repository/user.repository";
import { VerificationTokenRepository } from "./repository/verification-token.repository";
import { AuthService } from "./services/auth.service";
import { EmailService } from "./services/email.service";
import { buildAuthRouter } from "./routes/auth.routes";
import { handleError } from "./utils/error.handler";
import { logger } from "./utils/logger";

async function main() {
  // db
  await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS auth`).catch(() => {});
  await AppDataSource.initialize();
  logger.info("db connected");

  // composition root
  const users = new UserRepository();
  const verificationTokens = new VerificationTokenRepository();
  const email = new EmailService();
  const auth = new AuthService(users, verificationTokens, email);

  // app
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(rateLimit({ windowMs: 60 * 1000, max: 100 }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/", buildAuthRouter(auth));

  app.use(handleError);

  app.listen(config.port, () => logger.info({ port: config.port }, "auth-service listening"));
}

process.on("uncaughtException", (err) => { logger.error({ err }, "uncaughtException"); process.exit(1); });
process.on("unhandledRejection", (err) => { logger.error({ err }, "unhandledRejection"); process.exit(1); });

main().catch((err) => { logger.error({ err }, "fatal"); process.exit(1); });
