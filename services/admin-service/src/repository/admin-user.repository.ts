import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { AdminUser, AdminRole } from "../models/admin-user.model";

export class AdminUserRepository {
  private repo(tx?: EntityManager): Repository<AdminUser> {
    return tx ? tx.getRepository(AdminUser) : AppDataSource.getRepository(AdminUser);
  }

  findByEmail(email: string, tx?: EntityManager): Promise<AdminUser | null> {
    return this.repo(tx).findOne({ where: { email } });
  }

  findById(id: string, tx?: EntityManager): Promise<AdminUser | null> {
    return this.repo(tx).findOne({ where: { id } });
  }

  create(input: Partial<AdminUser>, tx?: EntityManager): Promise<AdminUser> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }

  save(user: AdminUser, tx?: EntityManager): Promise<AdminUser> {
    return this.repo(tx).save(user);
  }
}
