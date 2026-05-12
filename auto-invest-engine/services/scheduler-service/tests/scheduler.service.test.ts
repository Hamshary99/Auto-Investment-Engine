import { SchedulerService } from "../src/services/scheduler.service";
import { FakePublisher } from "./fakes/fake-publisher";
import { ROUTING_KEYS } from "@auto-invest/shared";

const TODAY = new Date().toISOString().slice(0, 10);

function buildSut() {
  const publisher = new FakePublisher();
  const scheduler = new SchedulerService(publisher);
  return { publisher, scheduler };
}

// ════════════════════════════════════════════════════════════════════════════
//  SchedulerService
// ════════════════════════════════════════════════════════════════════════════
describe("SchedulerService", () => {
  it("requestNavSnapshot: publishes nav.snapshot.requested with today's date", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // (no input — cron tick)
    const { publisher, scheduler } = buildSut();

    // ── ACT ───────────────────────────────────────────────────────────
    await scheduler.requestNavSnapshot();

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // events published: 1
    //   routingKey: nav.snapshot.requested
    //   payload:    { forDate: <today, ISO yyyy-mm-dd> }
    expect(publisher.published).toEqual([
      { routingKey: ROUTING_KEYS.NAV_SNAPSHOT_REQUESTED, payload: { forDate: TODAY }, messageId: undefined },
    ]);
  });

  it("requestReconciliation: publishes reconciliation.requested with today's date", async () => {
    // ── INPUT / ACT ───────────────────────────────────────────────────
    const { publisher, scheduler } = buildSut();
    await scheduler.requestReconciliation();

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(publisher.published).toEqual([
      { routingKey: ROUTING_KEYS.RECONCILIATION_REQUESTED, payload: { forDate: TODAY }, messageId: undefined },
    ]);
  });

  it("requestOrderSweep: publishes order.sweep.requested with the stale-order window", async () => {
    // ── INPUT / ACT ───────────────────────────────────────────────────
    const { publisher, scheduler } = buildSut();
    await scheduler.requestOrderSweep();

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // payload.olderThanSeconds = 300 (5 minutes — service-level constant)
    expect(publisher.published).toEqual([
      { routingKey: ROUTING_KEYS.ORDER_SWEEP_REQUESTED, payload: { olderThanSeconds: 300 }, messageId: undefined },
    ]);
  });

  it("does not publish anything when no method is called (sanity)", () => {
    const { publisher } = buildSut();
    expect(publisher.published).toHaveLength(0);
  });
});
