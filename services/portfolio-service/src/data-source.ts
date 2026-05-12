import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { Portfolio } from "./models/portfolio.model";
import { Holding } from "./models/holding.model";
import { Order } from "./models/order.model";
import { NavSnapshot } from "./models/nav-snapshot.model";
import { ProcessedMessage } from "./models/processed-message.model";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  schema: "portfolio",
  entities: [Portfolio, Holding, Order, NavSnapshot, ProcessedMessage],
  synchronize: true,
  logging: false,
});
