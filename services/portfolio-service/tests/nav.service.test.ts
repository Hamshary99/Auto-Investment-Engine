import { NavService } from "../src/services/nav.service";
import { FakePortfolioRepository } from "./fakes/fake-portfolio.repository";
import { FakeNavSnapshotRepository } from "./fakes/fake-nav-snapshot.repository";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function buildSut() {
  const portfolios = new FakePortfolioRepository();
  const snapshots = new FakeNavSnapshotRepository();
  const service = new NavService(portfolios, snapshots);
  return { service, portfolios, snapshots };
}

// ════════════════════════════════════════════════════════════════════════════
//  snapshotAll  —  NAV = cash + Σ(qty × markPrice).  markPrice is stubbed to avgCost.
// ════════════════════════════════════════════════════════════════════════════
describe("NavService.snapshotAll", () => {
  it("computes NAV per portfolio and writes one snapshot row", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, portfolios, snapshots } = buildSut();
    const portfolio = await portfolios.create({ userId: USER_A, cashBalance: "1000.00" });
    portfolio.holdings = [
      { id: "h1", portfolio, symbol: "AAPL", quantity: "10", avgCost: "100", updatedAt: new Date() },
      { id: "h2", portfolio, symbol: "MSFT", quantity: "5",  avgCost: "200", updatedAt: new Date() },
    ];
    await portfolios.save(portfolio);
    const request = { forDate: "2026-05-12" };

    // ── ACT ───────────────────────────────────────────────────────────
    const count = await service.snapshotAll(request.forDate);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // return:    1 (portfolios processed)
    // snapshot:  { portfolioId, forDate: "2026-05-12", navValue: "3000.00" }
    //            1000 cash + 10*100 + 5*200 = 3000
    expect(count).toBe(1);
    expect(snapshots.all()).toEqual([
      expect.objectContaining({ portfolioId: portfolio.id, forDate: "2026-05-12", navValue: "3000.00" }),
    ]);
  });

  it("re-running for the same date is idempotent (ON CONFLICT DO NOTHING)", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, portfolios, snapshots } = buildSut();
    const portfolio = await portfolios.create({ userId: USER_A, cashBalance: "500.00" });
    portfolio.holdings = [];
    await portfolios.save(portfolio);

    // ── ACT ───────────────────────────────────────────────────────────
    // run the snapshot job twice for the same date
    await service.snapshotAll("2026-05-12");
    await service.snapshotAll("2026-05-12");

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // snapshots table:  still 1 row (second insert ignored)
    expect(snapshots.all()).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  latestForUser
// ════════════════════════════════════════════════════════════════════════════
describe("NavService.latestForUser", () => {
  it("returns the snapshot with the most recent forDate", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service, portfolios, snapshots } = buildSut();
    const portfolio = await portfolios.create({ userId: USER_A, cashBalance: "0" });
    portfolio.holdings = [];
    await portfolios.save(portfolio);
    const seeded = [
      { forDate: "2026-05-10", navValue: "100.00" },
      { forDate: "2026-05-12", navValue: "300.00" }, // ← most recent
      { forDate: "2026-05-11", navValue: "200.00" },
    ];
    for (const s of seeded) await snapshots.insertIgnoreOnConflict({ portfolioId: portfolio.id, ...s });

    // ── ACT ───────────────────────────────────────────────────────────
    const latest = await service.latestForUser(USER_A);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // { forDate: "2026-05-12", navValue: "300.00" }
    expect(latest).toMatchObject({ forDate: "2026-05-12", navValue: "300.00" });
  });

  it("returns null when the user has no portfolio", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    const { service } = buildSut();
    const lookup = { userId: "ghost" };

    // ── ACT ───────────────────────────────────────────────────────────
    const result = await service.latestForUser(lookup.userId);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    // null
    expect(result).toBeNull();
  });
});
