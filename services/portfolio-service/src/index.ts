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
  UserPortfolioRepository,
  HoldingRepository,
  OrderRepository,
  NavSnapshotRepository,
  ProcessedMessageRepository,
  SubscribedPortfolioRepository,
  AutoInvestPlanRepository,
} from "./repository/index";

import {
  ProductTypeRepository,
  AssociatedIndexFundRepository,
  RiskProfileTemplateRepository,
  QuizRepository,
} from "@auto-invest/shared";

import {
  SubscribedPortfolioService,
  NavService,
  OrderService,
  ReconciliationService,
  InvestmentPlanService,
  QuizService,
} from "./services/index";

import { buildUserPortfolioRouter } from "./routes/user-portfolio.routes";
import { buildOrdersRouter } from "./routes/orders.routes";
import { buildProductTypeRouter } from "./routes/product-type.routes";
import { buildQuizRouter } from "./routes/quiz.routes";
import { buildInvestmentPlanRouter } from "./routes/investment-plan.routes";

import { startOrderExecutionConsumer } from "./consumers/order-execution.consumer";
import { startNavSnapshotConsumer } from "./consumers/nav-snapshot.consumer";
import { startReconciliationConsumer } from "./consumers/reconciliation.consumer";
import { startAutoInvestConsumer } from "./consumers/auto-invest.consumer";

import { handleError } from "./utils/error.handler";
import { logger } from "./utils/logger";
import { connectRabbit, Publisher } from "@auto-invest/shared";

async function main() {
  await AppDataSource.query(`CREATE SCHEMA IF NOT EXISTS portfolio`).catch(() => {});
  await AppDataSource.initialize();
  logger.info("db connected");

  const rabbit = await connectRabbit(config.rabbit.url, config.rabbit.exchange);
  const publisher = new Publisher(rabbit);

  const orderRepo = new OrderRepository();
  const userPortfolioRepo = new UserPortfolioRepository();
  const holdingRepo = new HoldingRepository();
  const navRepo = new NavSnapshotRepository();
  const inbox = new ProcessedMessageRepository();
  const productTypeRepo = new ProductTypeRepository(AppDataSource as any);
  const associatedIndexFundRepo = new AssociatedIndexFundRepository(AppDataSource as any);
  const subscribedPortfolioRepo = new SubscribedPortfolioRepository();
  const riskTemplateRepo = new RiskProfileTemplateRepository(AppDataSource as any);
  const quizRepo = new QuizRepository(AppDataSource as any);
  const autoInvestPlanRepo = new AutoInvestPlanRepository();

  const orderService = new OrderService(orderRepo, userPortfolioRepo, holdingRepo, publisher, autoInvestPlanRepo);
  const navService = new NavService(userPortfolioRepo, navRepo);
  const reconService = new ReconciliationService(orderRepo);
  const subscribedPortfolioService = new SubscribedPortfolioService(
    productTypeRepo,
    associatedIndexFundRepo,
    subscribedPortfolioRepo,
    userPortfolioRepo,
    autoInvestPlanRepo,
    orderService,
  );
  const quizService = new QuizService(quizRepo);
  const investmentPlanService = new InvestmentPlanService(
    autoInvestPlanRepo,
    productTypeRepo,
    riskTemplateRepo,
    userPortfolioRepo,
  );

  await startOrderExecutionConsumer(rabbit, orderService, inbox);
  await startNavSnapshotConsumer(rabbit, navService, inbox);
  await startReconciliationConsumer(rabbit, reconService, inbox);
  await startAutoInvestConsumer(rabbit, subscribedPortfolioService, autoInvestPlanRepo, inbox);

  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors());
  app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/", buildUserPortfolioRouter(userPortfolioRepo, navService));
  app.use("/", buildOrdersRouter(orderService));
  app.use("/", buildProductTypeRouter(subscribedPortfolioService));
  app.use("/", buildQuizRouter(quizService));
  app.use("/", buildInvestmentPlanRouter(investmentPlanService, subscribedPortfolioService));
  app.use(handleError);

  app.listen(config.port, () => logger.info({ port: config.port }, "portfolio-service listening"));
}

process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  logger.error({ err }, "unhandledRejection");
  process.exit(1);
});

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
