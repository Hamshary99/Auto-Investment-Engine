import { NavService } from "../src/services/nav.service";
import { FakeUserPortfolioRepository } from "./fakes/fake-user-portfolio.repository";
import { FakeNavSnapshotRepository } from "./fakes/fake-nav-snapshot.repository";

const USER_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function buildSut() {
  const userPortfolios = new FakeUserPortfolioRepository();
  const snapshots = new FakeNavSnapshotRepository();
  const service = new NavService(userPortfolios, snapshots);
  return { service, userPortfolios, snapshots };
}

describe("NavService.snapshotAll", () => {
  it("computes NAV per user portfolio and writes one snapshot row", async () => {
    const { service, userPortfolios, snapshots } = buildSut();
    const userPortfolio = await userPortfolios.create({ userId: USER_A, cashBalance: "1000.00" });
    userPortfolio.holdings = [
      {
        id: "h1",
        userPortfolio,
        symbol: "AAPL",
        quantity: "10",
        avgCost: "100",
        updatedAt: new Date(),
      },
      {
        id: "h2",
        userPortfolio,
        symbol: "MSFT",
        quantity: "5",
        avgCost: "200",
        updatedAt: new Date(),
      },
    ];
    await userPortfolios.save(userPortfolio);

    const count = await service.snapshotAll("2026-05-12");

    expect(count).toBe(1);
    expect(snapshots.all()).toEqual([
      expect.objectContaining({
        userPortfolioId: userPortfolio.id,
        forDate: "2026-05-12",
        navValue: "3000.00",
      }),
    ]);
  });

  it("re-running for the same date is idempotent", async () => {
    const { service, userPortfolios, snapshots } = buildSut();
    const userPortfolio = await userPortfolios.create({ userId: USER_A, cashBalance: "500.00" });
    userPortfolio.holdings = [];
    await userPortfolios.save(userPortfolio);

    await service.snapshotAll("2026-05-12");
    await service.snapshotAll("2026-05-12");

    expect(snapshots.all()).toHaveLength(1);
  });
});

describe("NavService.latestForUser", () => {
  it("returns the snapshot with the most recent forDate", async () => {
    const { service, userPortfolios, snapshots } = buildSut();
    const userPortfolio = await userPortfolios.create({ userId: USER_A, cashBalance: "0" });
    userPortfolio.holdings = [];
    await userPortfolios.save(userPortfolio);
    const seeded = [
      { forDate: "2026-05-10", navValue: "100.00" },
      { forDate: "2026-05-12", navValue: "300.00" },
      { forDate: "2026-05-11", navValue: "200.00" },
    ];
    for (const s of seeded) {
      await snapshots.insertIgnoreOnConflict({ userPortfolioId: userPortfolio.id, ...s });
    }

    const latest = await service.latestForUser(USER_A);

    expect(latest).toMatchObject({ forDate: "2026-05-12", navValue: "300.00" });
  });

  it("returns null when the user has no user portfolio", async () => {
    const { service } = buildSut();
    expect(await service.latestForUser("ghost")).toBeNull();
  });
});
