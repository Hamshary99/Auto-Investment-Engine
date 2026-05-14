const nodeEnv = process.env.NODE_ENV || "development";

export const config = {
  nodeEnv,
  isDev: nodeEnv === "development" || nodeEnv === "dev",
  port: parseInt(process.env.AUTH_PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "10", 10),
  db: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
    username: process.env.POSTGRES_USER || "invest",
    password: process.env.POSTGRES_PASSWORD || "investpass",
    database: process.env.POSTGRES_DB || "auto_invest",
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY || "",
    from: process.env.EMAIL_FROM || "Auto Invest <onboarding@resend.dev>",
    appUrl: process.env.APP_URL || "http://localhost:3000",
    verificationTtlHours: parseInt(process.env.EMAIL_VERIFICATION_TTL_HOURS || "24", 10),
  },
};
