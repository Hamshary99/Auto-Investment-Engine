import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { AdminUser } from "./models/admin-user.model";
import {
  ProductType,
  AssociatedIndexFund,
  RiskProfileTemplate,
  QuizQuestion,
  QuizAnswer,
} from "@auto-invest/shared";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  entities: [
    AdminUser,
    ProductType,
    AssociatedIndexFund,
    RiskProfileTemplate,
    QuizQuestion,
    QuizAnswer,
  ],
  synchronize: true, // Should be managed carefully in production
  logging: false,
});
