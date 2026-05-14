import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { VerificationToken } from "../models/verification-token.model";

export class VerificationTokenRepository {
  private repo(tx?: EntityManager): Repository<VerificationToken> {
    return tx ? tx.getRepository(VerificationToken) : AppDataSource.getRepository(VerificationToken);
  }

  create(input: { userId: string; tokenHash: string; expiresAt: Date }, tx?: EntityManager): Promise<VerificationToken> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }

  findByHash(tokenHash: string, tx?: EntityManager): Promise<VerificationToken | null> {
    return this.repo(tx).findOne({ where: { tokenHash } });
  }

  markUsed(id: string, tx?: EntityManager): Promise<unknown> {
    return this.repo(tx).update({ id }, { usedAt: new Date() });
  }

  invalidateAllForUser(userId: string, tx?: EntityManager): Promise<unknown> {
    return this.repo(tx)
      .createQueryBuilder()
      .update()
      .set({ usedAt: () => `COALESCE("usedAt", NOW())` })
      .where(`"userId" = :userId AND "usedAt" IS NULL`, { userId })
      .execute();
  }
}
