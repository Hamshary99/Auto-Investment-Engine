export const config = {
  port: parseInt(process.env.PORTFOLIO_PORT || "3002", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  internalSecret: process.env.INTERNAL_AUTH_SECRET || "dev-internal-secret",
  internalTokenTtlMs: parseInt(process.env.INTERNAL_AUTH_TTL_MS || "30000", 10),
  rabbit: {
    url: process.env.RABBITMQ_URL || "amqp://localhost",
    exchange: process.env.RABBITMQ_EXCHANGE || "auto-invest.events",
    prefetch: parseInt(process.env.CONSUMER_PREFETCH || "10", 10),
    maxRetries: parseInt(process.env.CONSUMER_MAX_RETRIES || "3", 10),
  },
  db: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "invest",
    password: process.env.POSTGRES_PASSWORD || "investpass",
    database: process.env.POSTGRES_DB || "auto_invest",
  },
};
