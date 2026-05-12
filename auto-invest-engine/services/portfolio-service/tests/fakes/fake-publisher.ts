import { Publisher, RoutingKey } from "@auto-invest/shared";

export class FakePublisher extends Publisher {
  public published: Array<{ routingKey: RoutingKey; payload: unknown; messageId?: string }> = [];

  constructor() {
    super({} as any); // Publisher constructor only stores ctx; we override publish below
  }

  async publish<T>(routingKey: RoutingKey, payload: T, messageId?: string): Promise<void> {
    this.published.push({ routingKey, payload, messageId });
  }
}
