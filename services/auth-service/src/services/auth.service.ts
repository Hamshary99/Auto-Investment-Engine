import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";
import { UserRepository } from "../repository/user.repository";
import { config } from "../config";
import { ApiError } from "../utils/error.handler";

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(email: string, password: string) {
    if (await this.users.findByEmail(email)) {
      throw new ApiError("email already registered", 409, "conflict");
    }
    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const user = await this.users.create({ email, passwordHash });
    return { id: user.id, email: user.email, token: this.sign(user) };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new ApiError("invalid credentials", 401, "unauthorized");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new ApiError("invalid credentials", 401, "unauthorized");
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
