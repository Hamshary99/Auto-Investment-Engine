import "reflect-metadata";
import { DataSource } from "typeorm";
import { config } from "./config";
import { User } from "./models/user.model";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.db.host,
  port: config.db.port,
  username: config.db.username,
  password: config.db.password,
  database: config.db.database,
  schema: "auth",
  entities: [User],
  synchronize: true, // demo only
  logging: false,
});
