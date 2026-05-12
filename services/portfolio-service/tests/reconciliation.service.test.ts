import { ReconciliationService } from "../src/services/reconciliation.service";
import { FakeOrderRepository } from "./fakes/fake-order.repository";

const USER = "11111111-1111-1111-1111-111111111111";
const HOUR = 60 * 60 * 1000;
const STUCK_THRESHOLD_MS = 1 * HOUR; // service flips PENDING orders older than this

function buildSut() {
  const orders = new FakeOrderRepository();
  const service = new ReconciliationService(orders);
  return { service, orders };
}

// ════════════════════════════════════════════════════════════════════════════
//  runForDate
//  Fails any order that has been PENDING longer than the stuck threshold (1h).
// ════════════════════════════════════════════════════════════════════════════
describe("ReconciliationService.runForDate", () => {
  it("transitions stuck PENDING orders to FAILED with a dated reason", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders } = buildSut();
    const stuck = await orders.create({
      userId: USER, symbol: "AAPL", side: "BUY", quantity: "1", status: "PENDING",
      createdAt: new Date(Date.now() - 2 * HOUR), // older than threshold
    });
    const request = { forDate: "2026-05-12" };

    // ── ACT ───────────────────────────────────────────────────────────
    const result = await service.runForDate(request.forDate);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // return:  { failed: 1 }
    // order:   { status: "FAILED", failureReason: /2026-05-12.*no broker confirmation/ }
    expect(result).toEqual({ failed: 1 });
    expect(await orders.findById(stuck.id)).toMatchObject({
      status: "FAILED",
      failureReason: expect.stringMatching(/2026-05-12.*no broker confirmation/i),
    });
  });

  it("leaves recent PENDING orders alone (younger than threshold)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders } = buildSut();
    const recent = await orders.create({
      userId: USER, symbol: "AAPL", side: "BUY", quantity: "1", status: "PENDING",
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    });

    // ── ACT ───────────────────────────────────────────────────────────
    const result = await service.runForDate("2026-05-12");

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // return:  { failed: 0 }
    // order:   still PENDING
    expect(result.failed).toBe(0);
    expect((await orders.findById(recent.id))?.status).toBe("PENDING");
  });

  it("ignores orders already in a terminal state (EXECUTED / FAILED)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, orders } = buildSut();
    const executed = await orders.create({
      userId: USER, symbol: "AAPL", side: "BUY", quantity: "1", status: "EXECUTED",
      createdAt: new Date(Date.now() - 10 * HOUR),
    });
    const failed = await orders.create({
      userId: USER, symbol: "AAPL", side: "BUY", quantity: "1", status: "FAILED",
      createdAt: new Date(Date.now() - 10 * HOUR),
    });

    // ── ACT ───────────────────────────────────────────────────────────
    const result = await service.runForDate("2026-05-12");

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // return:           { failed: 0 }
    // executed order:   still EXECUTED
    // failed order:     still FAILED
    expect(result.failed).toBe(0);
    expect((await orders.findById(executed.id))?.status).toBe("EXECUTED");
    expect((await orders.findById(failed.id))?.status).toBe("FAILED");

    // sanity-check the threshold value the test is built around
    expect(STUCK_THRESHOLD_MS).toBe(60 * 60 * 1000);
  });
});
