export const config = {
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
};
