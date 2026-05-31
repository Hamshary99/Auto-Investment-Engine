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

import { AdminUserRepository } from "./repository/admin-user.repository";

// Import Controllers and Services (Stubs)
import { AuthService, AuthController } from "./controllers/auth.controller";
import { ProductTypeService, ProductTypeController } from "./controllers/product-type.controller";
import { RiskProfileTemplateService, RiskProfileTemplateController } from "./controllers/risk-profile-template.controller";
import { QuizService, QuizController } from "./controllers/quiz.controller";

// Import Routers
import { buildAuthRouter } from "./routes/auth.routes";
import { buildProductTypeRouter } from "./routes/product-type.routes";
import { buildRiskProfileTemplateRouter } from "./routes/risk-profile-template.routes";
import { buildQuizRouter } from "./routes/quiz.routes";

async function main() {
  await AppDataSource.initialize();
  console.log("admin-service db connected");

  // Initialize Repositories
  const adminUserRepo = new AdminUserRepository();

  // Initialize Services
  const authService = new AuthService(adminUserRepo);
  const productTypeService = new ProductTypeService();
  const riskProfileTemplateService = new RiskProfileTemplateService();
  const quizService = new QuizService();

  // Initialize Controllers
  const authController = new AuthController(authService);
  const productTypeController = new ProductTypeController(productTypeService);
  const riskProfileTemplateController = new RiskProfileTemplateController(riskProfileTemplateService);
  const quizController = new QuizController(quizService);

  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors());
  app.use(rateLimit({ windowMs: 60 * 1000, max: 200 }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "admin-service" }));

  // Register Routes under /admin prefix
  app.use("/admin", buildAuthRouter(authController));
  app.use("/admin", buildProductTypeRouter(productTypeController));
  app.use("/admin", buildRiskProfileTemplateRouter(riskProfileTemplateController));
  app.use("/admin", buildQuizRouter(quizController));

  app.listen(config.port, () => console.log(`admin-service listening on port ${config.port}`));
}

process.on("uncaughtException", (err) => {
  console.error("uncaughtException", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("unhandledRejection", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});
