import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AuthService } from "../src/services/auth.service";
import { FakeUserRepository } from "./fake-user.repository";
import { config } from "../src/config";
import { ConflictError, UnauthorizedError, ValidationError } from "@auto-invest/shared";

describe("AuthService", () => {
  let users: FakeUserRepository;
  let auth: AuthService;

  beforeEach(() => {
    users = new FakeUserRepository();
    auth = new AuthService(users);
  });

  // ────────────────────────────────────────────────────────────────
  // register
  // ────────────────────────────────────────────────────────────────
  describe("register", () => {
    it("creates a user and returns id + email + valid JWT", async () => {
      // INPUT
      const email = "alice@example.com";
      const password = "hunter22!";

      // ACT
      const result = await auth.register(email, password);

      // OUTPUT
      expect(result).toEqual({
        id: expect.any(String),
        email: "alice@example.com",
        token: expect.any(String),
      });
      // JWT decodes to the right subject
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(decoded.sub).toBe(result.id);
      expect(decoded.email).toBe(email);

      // user is persisted
      expect(users.size()).toBe(1);
    });

    it("stores a bcrypt hash, not the plaintext password", async () => {
      // INPUT
      const password = "plaintextpw!";
      // ACT
      await auth.register("bob@example.com", password);
      // OUTPUT
      const stored = await users.findByEmail("bob@example.com");
      expect(stored!.passwordHash).not.toBe(password);
      expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt prefix
      await expect(bcrypt.compare(password, stored!.passwordHash)).resolves.toBe(true);
    });

    it.each([
      // [label, email, password]
      ["missing email",          "",                  "validpass1"],
      ["missing password",       "x@y.com",           ""],
      ["password too short (7)", "x@y.com",           "1234567"],
    ])("rejects %s with ValidationError", async (_label, email, password) => {
      // INPUT → expected OUTPUT
      await expect(auth.register(email, password)).rejects.toBeInstanceOf(ValidationError);
      expect(users.size()).toBe(0);
    });

    it("rejects duplicate email with ConflictError", async () => {
      // INPUT: register the same email twice
      await auth.register("dup@example.com", "firstpass1");
      // ACT + OUTPUT
      await expect(auth.register("dup@example.com", "secondpass2"))
        .rejects.toBeInstanceOf(ConflictError);
      expect(users.size()).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // login
  // ────────────────────────────────────────────────────────────────
  describe("login", () => {
    const email = "carol@example.com";
    const password = "carolpass1";

    beforeEach(async () => {
      await auth.register(email, password);
    });

    it("returns id + email + JWT for correct credentials", async () => {
      // ACT
      const result = await auth.login(email, password);
      // OUTPUT
      expect(result.email).toBe(email);
      expect(result.id).toEqual(expect.any(String));
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(decoded.sub).toBe(result.id);
    });

    it("rejects unknown email with UnauthorizedError", async () => {
      await expect(auth.login("ghost@example.com", password))
        .rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("rejects wrong password with UnauthorizedError", async () => {
      await expect(auth.login(email, "wrongpass1"))
        .rejects.toBeInstanceOf(UnauthorizedError);
    });

    it("uses the same error type for both wrong-email and wrong-password (no user enumeration)", async () => {
      // SECURITY: callers must not be able to tell which one was wrong
      const e1 = await auth.login("ghost@example.com", password).catch((e) => e);
      const e2 = await auth.login(email, "wrongpass1").catch((e) => e);
      expect(e1.constructor).toBe(e2.constructor);
      expect(e1.message).toBe(e2.message);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // token shape
  // ────────────────────────────────────────────────────────────────
  describe("issued JWTs", () => {
    it("contain sub, email, iat, exp and verify with the configured secret", async () => {
      const result = await auth.register("dave@example.com", "davepass1");
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;

      expect(decoded).toMatchObject({
        sub: result.id,
        email: "dave@example.com",
      });
      expect(decoded.iat).toEqual(expect.any(Number));
      expect(decoded.exp).toEqual(expect.any(Number));
      expect(decoded.exp! - decoded.iat!).toBeGreaterThan(0);
    });

    it("fail to verify when signed with a different secret", async () => {
      const result = await auth.register("eve@example.com", "evepass123");
      expect(() => jwt.verify(result.token, "not-the-real-secret")).toThrow();
    });
  });
});
