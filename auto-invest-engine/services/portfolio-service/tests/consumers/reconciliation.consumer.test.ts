import { startReconciliationConsumer } from "../../src/consumers/reconciliation.consumer";
import { ReconciliationService } from "../../src/services/reconciliation.service";
import { FakeOrderRepository } from "../fakes/fake-order.repository";
import { FakeProcessedMessageRepository } from "../fakes/fake-processed-message.repository";
import { FakeChannel } from "../fakes/fake-channel";
import { ROUTING_KEYS } from "@auto-invest/shared";

const USER = "11111111-1111-1111-1111-111111111111";
const HOUR = 60 * 60 * 1000;

async function buildHarness() {
  const channel = new FakeChannel();
  const ctx = { channel: channel.asChannel(), exchange: "auto-invest.events", connection: {} as any };
  const orders = new FakeOrderRepository();
  const inbox = new FakeProcessedMessageRepository();
  const recon = new ReconciliationService(orders);
  await startReconciliationConsumer(ctx, recon, inbox);
  return { channel, orders, inbox };
}

function buildEnvelope(opts: { forDate: string; messageId?: string }) {
  return {
    messageId: opts.messageId ?? "recon-msg-1",
    occurredAt: "2026-05-12T00:00:00.000Z",
    type: ROUTING_KEYS.RECONCILIATION_REQUESTED,
    payload: { forDate: opts.forDate },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  reconciliation consumer
// ════════════════════════════════════════════════════════════════════════════
describe("reconciliation consumer", () => {
  it("happy path: flips stuck PENDING orders to FAILED and ack's", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel, orders } = await buildHarness();
    const stuck = await orders.create({
      userId: USER, symbol: "AAPL", side: "BUY", quantity: "1", status: "PENDING",
      createdAt: new Date(Date.now() - 5 * HOUR), // well past the 1h SLA
    });
    const envelope = buildEnvelope({ forDate: "2026-05-12", messageId: "recon-msg-1" });

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // stuck order:  { status: "FAILED", failureReason: contains "2026-05-12" }
    // channel:      1 ack
    expect(await orders.findById(stuck.id)).toMatchObject({
      status: "FAILED",
      failureReason: expect.stringContaining("2026-05-12"),
    });
    expect(channel.acks).toHaveLength(1);
  });

  it("duplicate delivery: business logic does not run twice", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { channel } = await buildHarness();
    const envelope = buildEnvelope({ forDate: "2026-05-12", messageId: "recon-msg-1" });
    const runSpy = jest.spyOn(ReconciliationService.prototype, "runForDate");

    // ── ACT ───────────────────────────────────────────────────────────
    await channel.deliver(envelope);
    await channel.deliver(envelope);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // runForDate:  called exactly once  (second delivery short-circuits via inbox)
    // channel:     2 acks
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(channel.acks).toHaveLength(2);
    runSpy.mockRestore();
  });
});
