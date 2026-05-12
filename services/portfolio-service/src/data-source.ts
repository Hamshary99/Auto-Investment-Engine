import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { Portfolio } from "./entities/Portfolio";
import { Holding } from "./entities/Holding";
import { Order } from "./entities/Order";
import { NavSnapshot } from "./entities/NavSnapshot";
import { ProcessedMessage } from "./entities/ProcessedMessage";

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
