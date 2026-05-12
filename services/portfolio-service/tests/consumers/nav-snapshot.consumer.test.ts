import { startNavSnapshotConsumer } from "../../src/consumers/nav-snapshot.consumer";
import { NavService } from "../../src/services/nav.service";
import { FakePortfolioRepository } from "../fakes/fake-portfolio.repository";
import { FakeNavSnapshotRepository } from "../fakes/fake-nav-snapshot.repository";
import { FakeProcessedMessageRepository } from "../fakes/fake-processed-message.repository";
import { FakeChannel } from "../fakes/fake-channel";
import { ROUTING_KEYS } from "@auto-invest/shared";

const USER = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function buildHarness() {
  const channel = new FakeChannel();
  const ctx = { channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any };
  const portfolios = new FakePortfolioRepository();
  const snapshots = new FakeNavSnapshotRepository();
  const inbox = new FakeProcessedMessageRepository();
  const nav = new NavService(portfolios, snapshots);

  // seed: one portfolio with cash 1000 + 10 AAPL @ avg 100 → expected NAV = 2000
  const portfolio = await portfolios.create({ userId: USER, cashBalance: "1000.00" });
  portfolio.holdings = [
    { id: "h1", portfolio, symbol: "AAPL", quantity: "10", avgCost: "100", updatedAt: new Date() },
  ];
  await portfolios.save(portfolio);

  await startNavSnapshotConsumer(ctx, nav, inbox);
  return { channel, snapshots, inbox, portfolio };
}

function buildEnvelope(opts: { forDate: string; messageId?: string }) {
  return {
    messageId: opts.messageId ?? "nav-msg-1",
    occurredAt: "2026-05-12T21:00:00.000Z",
    type: ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED,
    payload: { forDate: opts.forDate },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  nav-snapshot consumer
// ════════════════════════════════════════════════════════════════════════════
describe("nav-snapshot consumer", () => {
  it("happy path: snapshots NAV for the requested date and ack's", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, snapshots, portfolio } = await buildHarness();
    const envelope = buildEnvelope({ forDate: "2026-05-12", messageId: "nav-msg-1" });

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // snapshots table:  1 row { portfolioId, forDate: "2026-05-12", navValue: "2000.00" }
    //                   (1000 cash + 10*100 = 2000)
    // channel:          1 ack
    expect(snapshots.all()).toEqual([
      expect.objectContaining({ portfolioId: portfolio.id, forDate: "2026-05-12", navValue: "2000.00" }),
    ]);
    expect(channel.acks).toHaveLength(1);
  });

  it("duplicate delivery: inbox guard skips re-snapshot (still 1 row)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, snapshots } = await buildHarness();
    const envelope = buildEnvelope({ forDate: "2026-05-12", messageId: "nav-msg-1" });

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // snapshots table:  still 1 row
    // channel:          2 acks (both deliveries accepted, second was a no-op)
    expect(snapshots.all()).toHaveLength(1);
    expect(channel.acks).toHaveLength(2);
  });
});
