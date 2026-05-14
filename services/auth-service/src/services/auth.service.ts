import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/user.model";
import { UserRepository } from "../repository/user.repository";
import { VerificationTokenRepository } from "../repository/verification-token.repository";
import { EmailService } from "./email.service";
import { config } from "../config";
import { ApiError } from "../utils/error.handler";
import { logger } from "../utils/logger";

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly verificationTokens: VerificationTokenRepository,
    private readonly email: EmailService,
  ) {}

  async register(email: string, password: string) {
    if (await this.users.findByEmail(email)) {
      logger.warn({ email }, "register rejected: email already registered");
      throw new ApiError("email already registered", 409, "conflict");
    }
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = await this.users.create({ email, passwordHash });
    if (config.isDev) {
      await this.users.markEmailVerified(user.id);
      logger.info({ userId: user.id, email }, "user registered (dev: email auto-verified)");
      const verified = { ...user, emailVerified: true } as User;
      return {
        id: user.id,
        email: user.email,
        emailVerified: true,
        token: this.sign(verified),
        message: "email auto-verified (development mode)",
      };
    }
    await this.issueVerificationEmail(user);
    logger.info({ userId: user.id, email }, "user registered");
    return {
      id: user.id,
      email: user.email,
      emailVerified: false,
      message: "verification email sent",
    };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      logger.warn({ email }, "login rejected: unknown email");
      throw new ApiError("invalid credentials", 401, "unauthorized");
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      logger.warn({ userId: user.id, email }, "login rejected: bad password");
      throw new ApiError("invalid credentials", 401, "unauthorized");
    }
    if (!user.emailVerified) {
      logger.warn({ userId: user.id, email }, "login rejected: email not verified");
      throw new ApiError("email not verified", 403, "email_not_verified");
    }
    logger.info({ userId: user.id, email }, "login ok");
    return { id: user.id, email: user.email, token: this.sign(user) };
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.verificationTokens.findByHash(tokenHash);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      logger.warn(
        { reason: !record ? "unknown" : record.usedAt ? "used" : "expired" },
        "verifyEmail rejected",
      );
      throw new ApiError("invalid or expired token", 400, "invalid_token");
    }
    const user = await this.users.findById(record.userId);
    if (!user) {
      logger.warn({ userId: record.userId }, "verifyEmail rejected: user missing");
      throw new ApiError("invalid or expired token", 400, "invalid_token");
    }

    await this.users.markEmailVerified(user.id);
    await this.verificationTokens.markUsed(record.id);
    logger.info({ userId: user.id, email: user.email }, "email verified");
    const refreshed = { ...user, emailVerified: true } as User;
    return { id: user.id, email: user.email, emailVerified: true, token: this.sign(refreshed) };
  }

  async resendVerification(email: string) {
    const user = await this.users.findByEmail(email);
    // do not leak whether the address exists
    if (!user || user.emailVerified) {
      logger.info(
        { email, found: !!user, verified: !!user?.emailVerified },
        "resendVerification: no-op",
      );
      return { message: "if the account exists, a new email was sent" };
    }
    await this.issueVerificationEmail(user);
    logger.info({ userId: user.id, email }, "verification email resent");
    return { message: "if the account exists, a new email was sent" };
  }

  private async issueVerificationEmail(user: User) {
    await this.verificationTokens.invalidateAllForUser(user.id);
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.email.verificationTtlHours * 3600 * 1000);
    await this.verificationTokens.create({ userId: user.id, tokenHash, expiresAt });
    await this.email.sendVerification(user.email, rawToken);
  }

  private hashToken(raw: string): string {
    return crypto.createHash("sha256").update(raw).digest("hex");
  }

  private sign(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );
  }
}
