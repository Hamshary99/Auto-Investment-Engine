export const config = {
  port: parseInt(process.env.ADMIN_PORT || "3004", 10),
  jwtSecret: process.env.ADMIN_JWT_SECRET || "admin-dev-secret",
  db: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "invest",
    password: process.env.POSTGRES_PASSWORD || "investpass",
    database: process.env.POSTGRES_DB || "auto_invest",
  },
};
