import amqp, { Channel, ChannelModel } from "amqplib";
import { createLogger } from "../logger";

const log = createLogger("rabbitmq");

export interface RabbitContext {
  connection: ChannelModel;
  channel: Channel;
  exchange: string;
}

export async function connectRabbit(url: string, exchange: string): Promise<RabbitContext> {
  let attempts = 0;
  while (true) {
    try {
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      await channel.assertExchange(exchange, "topic", { durable: true });
      log.info({ exchange }, "rabbitmq connected");

      connection.on("error", (e) => log.error({ err: e }, "rabbit conn error"));
      connection.on("close", () => log.warn("rabbit conn closed"));

      return { connection, channel, exchange };
    } catch (err) {
      attempts++;
      const delay = Math.min(30_000, 1000 * 2 ** attempts);
      log.warn({ err, attempts, delay }, "rabbit connect failed, retrying");
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
