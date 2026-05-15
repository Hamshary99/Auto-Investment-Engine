import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

import "reflect-metadata";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { AppDataSource } from "./data-source";
import { config } from "./config";

import {
  PortfolioRepository,
  HoldingRepository,
  OrderRepository,
  NavSnapshotRepository,
  ProcessedMessageRepository, 
  FundRepository,
  FundHoldingRepository,
} from "./repository/index";

import {
  FundService,
  NavService,
  OrderService,
  ReconciliationService,
} from "./services/index";

import { buildPortfolioRouter } from "./routes/portfolio.routes";
import { buildOrdersRouter } from "./routes/orders.routes";
import { buildFundRouter } from "./routes/fund.routes";

import { startOrderExecutionConsumer } from "./consumers/order-execution.consumer";
import { startNavSnapshotConsumer } from "./consumers/nav-snapshot.consumer";
import { startReconciliationConsumer } from "./consumers/reconciliation.consumer";

import { handleError } from "./utils/error.handler";
import { logger } from "./utils/logger";
import { connectRabbit, Publisher } from "@auto-invest/shared";

async function main() {
  // db
  await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS portfolio`).catch(() => {});
  await AppDataSource.initialize();
  logger.info("db connected");

  // rabbit
  const rabbit = await connectRabbit(config.rabbit.url, config.rabbit.exchange);
  const publisher = new Publisher(rabbit);

  // composition root — repos → services → consumers/routes
  const orderRepo = new OrderRepository();
  const portfolioRepo = new PortfolioRepository();
  const holdingRepo = new HoldingRepository();
  const navRepo = new NavSnapshotRepository();
  const inbox = new ProcessedMessageRepository();
  const fundRepo = new FundRepository();
  const fundHoldingRepo = new FundHoldingRepository();

  const orderService = new OrderService(orderRepo, portfolioRepo, holdingRepo, publisher);
  const navService = new NavService(portfolioRepo, navRepo);
  const reconService = new ReconciliationService(orderRepo);
  const fundService = new FundService(fundRepo, fundHoldingRepo, orderService);

  // consumers
  await startOrderExecutionConsumer(rabbit, orderService, inbox);
  await startNavSnapshotConsumer(rabbit, navService, inbox);
  await startReconciliationConsumer(rabbit, reconService, inbox);

  // app
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/", buildPortfolioRouter(portfolioRepo, navService));
  app.use("/", buildOrdersRouter(orderService));
  app.use("/", buildFundRouter(fundService));
  app.use(handleError);

  app.listen(config.port, () => logger.info({ port: config.port }, "portfolio-service listening"));
}

process.on("uncaughtException", (err) => { logger.error({ err }, "uncaughtException"); process.exit(1); });
process.on("unhandledRejection", (err) => { logger.error({ err }, "unhandledRejection"); process.exit(1); });

main().catch((err) => { logger.error({ err }, "fatal"); process.exit(1); });
