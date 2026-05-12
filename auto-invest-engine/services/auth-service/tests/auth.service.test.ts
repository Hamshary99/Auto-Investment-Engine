import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { AuthService } from "../src/services/auth.service";
import { FakeUserRepository } from "./fake-user.repository";
import { config } from "../src/config";
import { ApiError } from "../src/utils/error.handler";

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
      // ── INPUT ───────────────────────────────────────────────────
      const input = { email: "alice@example.com", password: "hunter22!" };

      // ── ACT ─────────────────────────────────────────────────────
      const result = await auth.register(input.email, input.password);

      // ── EXPECTED OUTPUT ─────────────────────────────────────────
      // { id, email: "alice@example.com", token: <jwt with sub=id and email=input.email> }
      expect(result).toEqual({
        id: expect.any(String),
        email: "alice@example.com",
        token: expect.any(String),
      });
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;
      expect(decoded.sub).toBe(result.id);
      expect(decoded.email).toBe(input.email);
      expect(users.size()).toBe(1);
    });

    it("stores a bcrypt hash, not the plaintext password", async () => {
      // ── INPUT ───────────────────────────────────────────────────
      const input = { email: "bob@example.com", password: "plaintextpw!" };

      // ── ACT ─────────────────────────────────────────────────────
      await auth.register(input.email, input.password);

      // ── EXPECTED OUTPUT ─────────────────────────────────────────
      // stored.passwordHash starts with "$2a$" / "$2b$" / "$2y$" and verifies against input.password
      const stored = await users.findByEmail(input.email);
      expect(stored!.passwordHash).not.toBe(input.password);
      expect(stored!.passwordHash).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(input.password, stored!.passwordHash)).resolves.toBe(true);
    });

    it("rejects duplicate email with ApiError(409, 'conflict')", async () => {
      // ── INPUT ───────────────────────────────────────────────────
      // register the same email twice
      await auth.register("dup@example.com", "firstpass1");

      // ── ACT + EXPECTED OUTPUT ───────────────────────────────────
      // throws ApiError with statusCode 409 / type "conflict"
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
    const email = "carol@example.com";
    const password = "carolpass1";

    beforeEach(async () => {
      await auth.register(email, password);
    });

    it("returns id + email + JWT for correct credentials", async () => {
      // ── INPUT ───────────────────────────────────────────────────
      const input = { email, password };

      // ── ACT ─────────────────────────────────────────────────────
      const result = await auth.login(input.email, input.password);

      // ── EXPECTED OUTPUT ─────────────────────────────────────────
      // { id, email, token } — token decodes to sub=id
      expect(result.email).toBe(email);
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
      const err = await auth.login(email, "wrongpass1").catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(401);
    });

    it("uses the same error for wrong-email vs wrong-password (no user enumeration)", async () => {
      // ── INPUT ───────────────────────────────────────────────────
      // case A: unknown email
      // case B: correct email + wrong password
      const a = await auth.login("ghost@example.com", password).catch((e) => e);
      const b = await auth.login(email, "wrongpass1").catch((e) => e);

      // ── EXPECTED OUTPUT ─────────────────────────────────────────
      // same class, same statusCode, same message — caller cannot distinguish
      expect(a.constructor).toBe(b.constructor);
      expect(a.statusCode).toBe(b.statusCode);
      expect(a.message).toBe(b.message);
    });
  });

  // ────────────────────────────────────────────────────────────────
  // issued JWTs
  // ────────────────────────────────────────────────────────────────
  describe("issued JWTs", () => {
    it("contain sub + email + iat + exp and verify with the configured secret", async () => {
      const result = await auth.register("dave@example.com", "davepass1");
      const decoded = jwt.verify(result.token, config.jwtSecret) as jwt.JwtPayload;

      expect(decoded).toMatchObject({ sub: result.id, email: "dave@example.com" });
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
