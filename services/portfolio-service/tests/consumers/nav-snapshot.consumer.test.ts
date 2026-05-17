import { startNavSnapshotConsumer } from "../../src/consumers/nav-snapshot.consumer";
import { NavService } from "../../src/services/nav.service";
import { FakeUserPortfolioRepository } from "../fakes/fake-user-portfolio.repository";
import { FakeNavSnapshotRepository } from "../fakes/fake-nav-snapshot.repository";
import { FakeProcessedMessageRepository } from "../fakes/fake-processed-message.repository";
import { FakeChannel } from "../fakes/fake-channel";
import { ROUTING_KEYS } from "@auto-invest/shared";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function buildHarness() {
  const channel = new FakeChannel();
  const ctx = { channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any };
  const userPortfolios = new FakeUserPortfolioRepository();
  const snapshots = new FakeNavSnapshotRepository();
  const inbox = new FakeProcessedMessageRepository();
  const nav = new NavService(userPortfolios, snapshots);

  const userPortfolio = await userPortfolios.create({ userId: USER, cashBalance: "1000.00" });
  userPortfolio.holdings = [
    {
      id: "h1",
      userPortfolio,
      symbol: "AAPL",
      quantity: "10",
      avgCost: "100",
      updatedAt: new Date(),
    },
  ];
  await userPortfolios.save(userPortfolio);

  await startNavSnapshotConsumer(ctx, nav, inbox);
  return { channel, snapshots, inbox, userPortfolio };
}

function buildEnvelope(opts: { forDate: string; messageId?: string }) {
  return {
    messageId: opts.messageId ?? "nav-msg-1",
    occurredAt: "2026-05-12T21:00:00.000Z",
    type: ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED,
    payload: { forDate: opts.forDate },
  };
}

describe("nav-snapshot consumer", () => {
  it("happy path: snapshots NAV for the requested date and ack's", async () => {
    const { channel, snapshots, userPortfolio } = await buildHarness();
    const envelope = buildEnvelope({ forDate: "2026-05-12", messageId: "nav-msg-1" });

    await channel.deliver(envelope);

    expect(snapshots.all()).toEqual([
      expect.objectContaining({
        userPortfolioId: userPortfolio.id,
        forDate: "2026-05-12",
        navValue: "2000.00",
      }),
    ]);
    expect(channel.acks).toHaveLength(1);
  });

  it("duplicate delivery: inbox guard skips re-snapshot (still 1 row)", async () => {
    const { channel, snapshots } = await buildHarness();
    const envelope = buildEnvelope({ forDate: "2026-05-12", messageId: "nav-msg-1" });

    await channel.deliver(envelope);
    await channel.deliver(envelope);

    expect(snapshots.all()).toHaveLength(1);
    expect(channel.acks).toHaveLength(2);
  });
});
