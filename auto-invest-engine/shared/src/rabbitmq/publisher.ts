import { v4 as uuid } from "uuid";
import { RabbitContext } from "./connection";
import { EventEnvelope, RoutingKey } from "../events/types";

export class Publisher {
  constructor(private readonly ctx: RabbitContext) {}

  async publish<T>(routingKey: RoutingKey, payload: T, messageId = uuid()): Promise<void> {
    const envelope: EventEnvelope<T> = {
      messageId,
      occurredAt: new Date().toISOString(),
      type: routingKey,
      payload,
    };
    this.ctx.channel.publish(
      this.ctx.exchange,
      routingKey,
      Buffer.from(JSON.stringify(envelope)),
      { persistent: true, messageId, contentType: "application/json" }
    );
  }
}
