import { randomUUID } from "crypto";
import { VerificationToken } from "../src/models/verification-token.model";
import { VerificationTokenRepository } from "../src/repository/verification-token.repository";

export class FakeVerificationTokenRepository extends VerificationTokenRepository {
  private byId = new Map<string, VerificationToken>();
  private byHash = new Map<string, VerificationToken>();

  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<VerificationToken> {
    const record: VerificationToken = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    };
    this.byId.set(record.id, record);
    this.byHash.set(record.tokenHash, record);
    return record;
  }

  async findByHash(tokenHash: string): Promise<VerificationToken | null> {
    return this.byHash.get(tokenHash) ?? null;
  }

  async markUsed(id: string): Promise<unknown> {
    const record = this.byId.get(id);
    if (record) record.usedAt = new Date();
    return undefined;
  }

  async invalidateAllForUser(userId: string): Promise<unknown> {
    for (const record of this.byId.values()) {
      if (record.userId === userId && !record.usedAt) record.usedAt = new Date();
    }
    return undefined;
  }

  all(): VerificationToken[] {
    return [...this.byId.values()];
  }
}
