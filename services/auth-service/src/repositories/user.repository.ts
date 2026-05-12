import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { User } from "../entities/User";

export class UserRepository {
  private repo(tx?: EntityManager): Repository<User> {
    return tx ? tx.getRepository(User) : AppDataSource.getRepository(User);
  }

  findByEmail(email: string, tx?: EntityManager): Promise<User | null> {
    return this.repo(tx).findOne({ where: { email } });
  }

  findById(id: string, tx?: EntityManager): Promise<User | null> {
    return this.repo(tx).findOne({ where: { id } });
  }

  create(input: { email: string; passwordHash: string }, tx?: EntityManager): Promise<User> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }
}
