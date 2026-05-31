import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { AdminUserRepository } from "../repository/admin-user.repository";
import { AdminRole } from "../models/admin-user.model";
import { generateAdminToken } from "../utils/jwt";

export class AuthService {
  constructor(private adminUserRepo: AdminUserRepository) {}

  async register(email: string, passwordRaw: string, role: AdminRole = AdminRole.CATALOG_ADMIN) {
    const existing = await this.adminUserRepo.findByEmail(email);
    if (existing) throw new Error("Email already registered");

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(passwordRaw, salt);

    const user = await this.adminUserRepo.create({
      email,
      passwordHash,
      role,
    });

    return { id: user.id, email: user.email, role: user.role };
  }

  async login(email: string, passwordRaw: string) {
    const user = await this.adminUserRepo.findByEmail(email);
    if (!user) throw new Error("Invalid credentials");

    const isMatch = await bcrypt.compare(passwordRaw, user.passwordHash);
    if (!isMatch) throw new Error("Invalid credentials");

    const token = generateAdminToken({ adminId: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }
}

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

      const result = await this.authService.login(email, password);
      res.json(result);
    } catch (err: any) {
      if (err.message === "Invalid credentials") return res.status(401).json({ error: err.message });
      next(err);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Missing email or password" });

      const result = await this.authService.register(email, password, role);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.message === "Email already registered") return res.status(409).json({ error: err.message });
      next(err);
    }
  };
}
