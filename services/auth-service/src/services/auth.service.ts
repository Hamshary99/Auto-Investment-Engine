import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../entities/User";
import { UserRepository } from "../repositories/user.repository";
import { config } from "../config";
import { ConflictError, UnauthorizedError, ValidationError } from "@auto-invest/shared";

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(email: string, password: string) {
    if (!email || !password || password.length < 8) {
      throw new ValidationError("email and password (min 8 chars) required");
    }
    if (await this.users.findByEmail(email)) {
      throw new ConflictError("email already registered");
    }
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = await this.users.create({ email, passwordHash });
    return { id: user.id, email: user.email, token: this.sign(user) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedError("invalid credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("invalid credentials");
    return { id: user.id, email: user.email, token: this.sign(user) };
  }

  private sign(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );
  }
}
