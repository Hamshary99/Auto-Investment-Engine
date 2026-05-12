export const config = {
  port: parseInt(process.env.APP_PORT || "3000", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  internalSecret: process.env.INTERNAL_AUTH_SECRET || "dev-internal-secret",
  internalTokenTtlMs: parseInt(process.env.INTERNAL_AUTH_TTL_MS || "30000", 10),
  authUpstream: process.env.AUTH_UPSTREAM || "http://auth-service:3001",
  portfolioUpstream: process.env.PORTFOLIO_UPSTREAM || "http://portfolio-service:3002",
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000,http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || "120", 10),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10),
  },
  trustProxy: process.env.TRUST_PROXY === "true",
};
