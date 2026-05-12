import { ProcessedMessageRepository } from "../../src/repository/processed-message.repository";

export class FakeProcessedMessageRepository extends ProcessedMessageRepository {
  public seen = new Set<string>();

  async markProcessed(messageId: string): Promise<boolean> {
    if (this.seen.has(messageId)) return false;
    this.seen.add(messageId);
    return true;
  }
}
