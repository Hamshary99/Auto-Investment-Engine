import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { ProcessedMessage } from "../models/processed-message.model";

export class ProcessedMessageRepository {
  private repo(tx?: EntityManager): Repository<ProcessedMessage> {
    return tx ? tx.getRepository(ProcessedMessage) : AppDataSource.getRepository(ProcessedMessage);
  }

  /**
   * Inbox-pattern guard. Returns true on first-time, false if this messageId
   * has already been processed (PK violation, Postgres code 23505).
   * MUST be called inside the same tx as the side-effect it gates.
   */
  async markProcessed(messageId: string, type: string, tx?: EntityManager): Promise<boolean> {
    try {
      await this.repo(tx).insert({ messageId, type });
      return true;
    } catch (e: any) {
      if (e.code === "23505") return false;
      throw e;
    }
  }
}
