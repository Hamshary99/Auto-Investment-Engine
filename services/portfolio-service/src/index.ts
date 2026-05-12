import "reflect-metadata";
import express, { NextFunction, Request, Response } from "express";
import { AppDataSource } from "./data-source";
import { config } from "./config";

import { OrderRepository } from "./repositories/order.repository";
import { PortfolioRepository } from "./repositories/portfolio.repository";
import { HoldingRepository } from "./repositories/holding.repository";
import { NavSnapshotRepository } from "./repositories/nav-snapshot.repository";
import { ProcessedMessageRepository } from "./repositories/processed-message.repository";

import { OrderService } from "./services/order.service";
import { NavService } from "./services/nav.service";
import { ReconciliationService } from "./services/reconciliation.service";

import { buildPortfolioRouter } from "./routes/portfolio.routes";
import { buildOrdersRouter } from "./routes/orders.routes";

import { startOrderExecutionConsumer } from "./consumers/order-execution.consumer";
import { startNavSnapshotConsumer } from "./consumers/nav-snapshot.consumer";
import { startReconciliationConsumer } from "./consumers/reconciliation.consumer";

import { AppError, connectRabbit, createLogger, Publisher } from "@auto-invest/shared";

const log = createLogger("portfolio-service");

async function main() {
  await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS portfolio`).catch(() => {});
  await AppDataSource.initialize();
  log.info("db connected");

  const rabbit = await connectRabbit(config.rabbit.url, config.rabbit.exchange);
  const publisher = new Publisher(rabbit);

  // composition root: repos → services → consumers/routes
  const orderRepo = new OrderRepository();
  const portfolioRepo = new PortfolioRepository();
  const holdingRepo = new HoldingRepository();
  const navRepo = new NavSnapshotRepository();
  const inbox = new ProcessedMessageRepository();

  const orderService = new OrderService(orderRepo, portfolioRepo, holdingRepo, publisher);
  const navService = new NavService(portfolioRepo, navRepo);
  const reconService = new ReconciliationService(orderRepo);

  await startOrderExecutionConsumer(rabbit, orderService, inbox);
  await startNavSnapshotConsumer(rabbit, navService, inbox);
  await startReconciliationConsumer(rabbit, reconService, inbox);

  const app = express();
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/", buildPortfolioRouter(portfolioRepo, navService));
  app.use("/", buildOrdersRouter(orderService));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    log.error({ err }, "unhandled");
    res.status(500).json({ error: "internal_error" });
  });

  app.listen(config.port, () => log.info({ port: config.port }, "portfolio-service listening"));
}

main().catch((err) => {
  log.error({ err }, "fatal");
  process.exit(1);
});
