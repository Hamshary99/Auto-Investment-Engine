import { NavSnapshot } from "../../src/models/nav-snapshot.model";
import { NavSnapshotRepository } from "../../src/repository/nav-snapshot.repository";

export class FakeNavSnapshotRepository extends NavSnapshotRepository {
  private byKey = new Map<string, NavSnapshot>();

  insertIgnoreOnConflict(input: { portfolioId: string; forDate: string; navValue: string }): any {
    const key = `${input.portfolioId}|${input.forDate}`;
    if (!this.byKey.has(key)) {
      this.byKey.set(key, {
        id: key,
        portfolioId: input.portfolioId,
        forDate: input.forDate,
        navValue: input.navValue,
        createdAt: new Date(),
      });
    }
    return Promise.resolve({ identifiers: [], generatedMaps: [], raw: [] });
  }

  async latestForPortfolio(portfolioId: string): Promise<NavSnapshot | null> {
    const all = [...this.byKey.values()].filter((s) => s.portfolioId === portfolioId);
    if (!all.length) return null;
    return all.sort((a, b) => b.forDate.localeCompare(a.forDate))[0];
  }

  all(): NavSnapshot[] { return [...this.byKey.values()]; }
}
