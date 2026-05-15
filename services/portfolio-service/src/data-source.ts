import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import {
  Portfolio,
  Holding,
  Order,
  NavSnapshot,
  ProcessedMessage,
  Fund,
  FundHolding,
} from "./models/index";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  schema: "portfolio",
  entities: [Portfolio, Holding, Order, NavSnapshot, ProcessedMessage, Fund, FundHolding],
  synchronize: true,
  logging: false,
});
