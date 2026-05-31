import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../.env"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../../.env.local"), override: true });

import express from "express";
import helmet from "helmet";
import cors from "cors";
import { createLogger } from "@auto-invest/shared";
import { config } from "./config";
import { stripClientInternalHeaders, verifyUserJwt, injectInternalAuth } from "./auth";
import {
  globalLimiter,
  authLimiter,
  authProxy,
  portfolioProxy,
  adminProxy,
  authRoutingMiddleware,
  adminRoutingMiddleware,
  errorHandler,
} from "./middlewares";

const log = createLogger("app-service");
const app = express();

if (config.trustProxy) app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
    hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  })
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("origin_not_allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-Requested-With"],
    maxAge: 600,
  })
);

app.use(stripClientInternalHeaders);
app.use(globalLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth", authRoutingMiddleware, authProxy);

app.use("/admin/auth/login", authLimiter);
app.use("/admin/auth/register", authLimiter);
app.use("/admin", adminRoutingMiddleware, adminProxy);

app.use("/api", verifyUserJwt, injectInternalAuth, portfolioProxy);

app.use((_req, res) => res.status(404).json({ error: "not_found" }));
app.use(errorHandler);

app.listen(config.port, () => log.info({ port: config.port }, "app-service listening"));
