import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AuthService } from "../src/services/auth.service";
import { FakeUserRepository } from "./fake-user.repository";
import { FakeVerificationTokenRepository } from "./fake-verification-token.repository";
import { FakeEmailService } from "./fake-email.service";
import { config } from "../src/config";
import { ApiError } from "../src/utils/error.handler";

describe("AuthService", () => {
  let users: FakeUserRepository;
  let tokens: FakeVerificationTokenRepository;
  let email: FakeEmailService;
  let auth: AuthService;

  beforeEach(() => {
    users = new FakeUserRepository();
    tokens = new FakeVerificationTokenRepository();
    email = new FakeEmailService();
    auth = new AuthService(users, tokens, email);
  });

  // ────────────────────────────────────────────────────────────────
  // register
  // ────────────────────────────────────────────────────────────────
  describe("register", () => {
    it("creates an unverified user and sends a verification email (no JWT)", async () => {
      const result = await auth.register("alice@example.com", "hunter22!");

      expect(result).toEqual({
        id: expect.any(String),
        email: "alice@example.com",
        emailVerified: false,
        message: expect.any(String),
      });
      expect(result).not.toHaveProperty("token");
      expect(users.size()).toBe(1);
      expect(email.sent).toHaveLength(1);
      expect(email.sent[0].to).toBe("alice@example.com");
      expect(email.sent[0].token).toMatch(/^[0-9a-f]{64}$/);
    });

    it("stores a bcrypt hash, not the plaintext password", async () => {
      await auth.register("bob@example.com", "plaintextpw!");

      const stored = await users.findByEmail("bob@example.com");
      expect(stored!.passwordHash).not.toBe("plaintextpw!");
      expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare("plaintextpw!", stored!.passwordHash)).resolves.toBe(true);
    });

    it("rejects duplicate email with ApiError(409, 'conflict')", async () => {
      await auth.register("dup@example.com", "firstpass1");

      const err = await auth.register("dup@example.com", "secondpass2").catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(409);
      expect(err.type).toBe("conflict");
      expect(users.size()).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // login
  // ────────────────────────────────────────────────────────────────
  describe("login", () => {
    const userEmail = "carol@example.com";
    const password = "carolpass1";

    beforeEach(async () => {
      await auth.register(userEmail, password);
    });

    it("blocks login until email is verified", async () => {
      const err = await auth.login(userEmail, password).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(403);
      expect(err.type).toBe("email_not_verified");
    });

    it("returns id + email + JWT after verification", async () => {
      const token = email.lastTokenFor(userEmail)!;
      await auth.verifyEmail(token);

      const result = await auth.login(userEmail, password);
      expect(result.email).toBe(userEmail);
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(decoded.sub).toBe(result.id);
    });

    it("rejects unknown email with ApiError(401, 'unauthorized')", async () => {
      const err = await auth.login("ghost@example.com", password).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
      expect(err.type).toBe("unauthorized");
    });

    it("rejects wrong password with ApiError(401, 'unauthorized')", async () => {
      const err = await auth.login(userEmail, "wrongpass1").catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
    });

    it("uses the same error for wrong-email vs wrong-password (no user enumeration)", async () => {
      const a = await auth.login("ghost@example.com", password).catch((e) => e);
      const b = await auth.login(userEmail, "wrongpass1").catch((e) => e);
      expect(a.constructor).toBe(b.constructor);
      expect(a.statusCode).toBe(b.statusCode);
      expect(a.message).toBe(b.message);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // verifyEmail
  // ────────────────────────────────────────────────────────────────
  describe("verifyEmail", () => {
    const userEmail = "verify@example.com";
    const password = "verifypass1";

    beforeEach(async () => {
      await auth.register(userEmail, password);
    });

    it("flips emailVerified and returns a valid JWT", async () => {
      const token = email.lastTokenFor(userEmail)!;
      const result = await auth.verifyEmail(token);

      expect(result).toEqual({
        id: expect.any(String),
        email: userEmail,
        emailVerified: true,
        token: expect.any(String),
      });
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(decoded.sub).toBe(result.id);

      const stored = await users.findByEmail(userEmail);
      expect(stored!.emailVerified).toBe(true);
      expect(stored!.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it("rejects an unknown token with ApiError(400, 'invalid_token')", async () => {
      const err = await auth.verifyEmail("a".repeat(64)).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(400);
      expect(err.type).toBe("invalid_token");
    });

    it("rejects a token that has already been used", async () => {
      const token = email.lastTokenFor(userEmail)!;
      await auth.verifyEmail(token);

      const err = await auth.verifyEmail(token).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.type).toBe("invalid_token");
    });

    it("rejects an expired token", async () => {
      const token = email.lastTokenFor(userEmail)!;
      // force-expire all outstanding tokens
      for (const rec of tokens.all()) rec.expiresAt = new Date(Date.now() - 1000);

      const err = await auth.verifyEmail(token).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.type).toBe("invalid_token");
    });
  });

  // ────────────────────────────────────────────────────────────────
  // resendVerification
  // ────────────────────────────────────────────────────────────────
  describe("resendVerification", () => {
    it("sends a new email and invalidates the prior token", async () => {
      await auth.register("re@example.com", "repass1234");
      const firstToken = email.lastTokenFor("re@example.com")!;

      await auth.resendVerification("re@example.com");
      const secondToken = email.lastTokenFor("re@example.com")!;

      expect(secondToken).not.toBe(firstToken);
      expect(email.sent).toHaveLength(2);

      // first token can no longer be used
      const err = await auth.verifyEmail(firstToken).catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.type).toBe("invalid_token");

      // second token still works
      const result = await auth.verifyEmail(secondToken);
      expect(result.emailVerified).toBe(true);
    });

    it("returns a generic message for unknown email (no enumeration, no send)", async () => {
      const result = await auth.resendVerification("nobody@example.com");
      expect(result).toEqual({ message: expect.any(String) });
      expect(email.sent).toHaveLength(0);
    });

    it("does not send when the user is already verified", async () => {
      await auth.register("done@example.com", "donepass1");
      const token = email.lastTokenFor("done@example.com")!;
      await auth.verifyEmail(token);
      email.sent.length = 0;

      await auth.resendVerification("done@example.com");
      expect(email.sent).toHaveLength(0);
    });
  });
});
