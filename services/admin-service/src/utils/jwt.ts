import jwt from "jsonwebtoken";
import { config } from "../config";
import { AdminRole } from "../models/admin-user.model";

export interface AdminJwtPayload {
  adminId: string;
  role: AdminRole;
}

export function generateAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "1d" });
}

export function verifyAdminToken(token: string): AdminJwtPayload {
  return jwt.verify(token, config.jwtSecret) as AdminJwtPayload;
}
