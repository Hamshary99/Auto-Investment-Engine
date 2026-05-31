import { Request, Response, NextFunction } from "express";
import { verifyAdminToken, AdminJwtPayload } from "../utils/jwt";
import { AdminRole } from "../models/admin-user.model";

export interface AdminRequest extends Request {
  admin?: AdminJwtPayload;
}

export function requireAdminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = verifyAdminToken(token);
    req.admin = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req: AdminRequest, res: Response, next: NextFunction) {
  if (!req.admin) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  if (req.admin.role !== AdminRole.SUPER_ADMIN) {
    return res.status(403).json({ error: "Forbidden: Super Admin access required" });
  }
  
  next();
}
