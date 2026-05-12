import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import { createLogger } from "@auto-invest/shared";
import { config } from "./config";
import {
  injectInternalAuth,
  stripClientInternalHeaders,
  verifyUserJwt,
} from "./auth";

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

const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

app.get("/health", (_req, res) => res.json({ ok: true }));

const authProxy = createProxyMiddleware({
  target: config.authUpstream,
  changeOrigin: true,
  pathRewrite: { "^/auth": "" },
  xfwd: true,
});

const portfolioProxy = createProxyMiddleware({
  target: config.portfolioUpstream,
  changeOrigin: true,
  pathRewrite: { "^/api": "" },
  xfwd: true,
});

// Public auth endpoints (login/register) — rate-limited, no JWT required.
app.use("/auth/login", authLimiter, authProxy);
app.use("/auth/register", authLimiter, authProxy);

// Protected auth endpoints (e.g. /me) — verify JWT, inject internal context.
app.use("/auth", verifyUserJwt, injectInternalAuth, authProxy);

// All portfolio/order routes — protected.
app.use("/api", verifyUserJwt, injectInternalAuth, portfolioProxy);

app.use((_req, res) => res.status(404).json({ error: "not_found" }));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message === "origin_not_allowed") {
    return res.status(403).json({ error: "cors_origin_not_allowed" });
  }
  log.error({ err }, "app-service error");
  res.status(500).json({ error: "internal_error" });
});

app.listen(config.port, () => log.info({ port: config.port }, "app-service listening"));
