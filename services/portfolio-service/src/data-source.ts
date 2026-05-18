import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import {
  UserPortfolio,
  Holding,
  Order,
  NavSnapshot,
  ProcessedMessage,
  ProductType,
  AssociatedIndexFund,
  SubscribedPortfolio,
  RiskProfileTemplate,
  QuizQuestion,
  QuizAnswer,
  AutoInvestPlan,
  AutoInvestAllocation,
} from "./models/index";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  schema: "portfolio",
  entities: [
    UserPortfolio,
    Holding,
    Order,
    NavSnapshot,
    ProcessedMessage,
    ProductType,
    AssociatedIndexFund,
    SubscribedPortfolio,
    RiskProfileTemplate,
    QuizQuestion,
    QuizAnswer,
    AutoInvestPlan,
    AutoInvestAllocation,
  ],
  synchronize: true,
  logging: false,
});
