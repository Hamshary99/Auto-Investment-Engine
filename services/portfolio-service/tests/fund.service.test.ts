jest.mock("../src/data-source", () => ({
  AppDataSource: {
    transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)),
  },
}));

jest.mock("../src/services/price.stub", () => ({
  // deterministic prices for the test symbols
  getStubPrice: (symbol: string) => {
    const map: Record<string, number> = { AAPL: 100, MSFT: 200, NVDA: 400 };
    const p = map[symbol];
    if (p == null) throw new Error(`no stub price for ${symbol}`);
    return p;
  },
}));

import { randomUUID } from "crypto";
import { FundService } from "../src/services/fund.service";
import { FundRepository } from "../src/repository/fund.repository";
import { FundHoldingRepository } from "../src/repository/fund.holding.repository";
import { OrderService } from "../src/services/order.service";
import { Fund } from "../src/models/fund.model";
import { FundHolding } from "../src/models/fund-holding.model";
import { Order, OrderSide } from "../src/models/order.model";

const USER = "11111111-1111-1111-1111-111111111111";
const FUND_ID = "22222222-2222-2222-2222-222222222222";

class FakeFundRepository extends FundRepository {
  private byId = new Map<string, Fund>();
  seed(f: Partial<Fund> & { id: string }) {
    this.byId.set(f.id, f as Fund);
  }
  async findByActive(): Promise<Fund[]> {
    return [...this.byId.values()].filter((f) => f.isActive);
  }
  async findById(id: string): Promise<Fund | null> {
    return this.byId.get(id) ?? null;
  }
  async findByIdActive(id: string, isActive: boolean): Promise<Fund | null> {
    const f = this.byId.get(id);
    return f && f.isActive === isActive ? f : null;
  }
}

class FakeFundHoldingRepository extends FundHoldingRepository {
  private byFund = new Map<string, FundHolding[]>();
  seed(fundId: string, holdings: Array<{ symbol: string; targetWeight: number }>) {
    this.byFund.set(
      fundId,
      holdings.map((h) => ({
        id: randomUUID(),
        symbol: h.symbol,
        targetWeight: h.targetWeight,
        fund: { id: fundId } as Fund,
      })),
    );
  }
  async findByFundId(fundId: string): Promise<FundHolding[]> {
    return this.byFund.get(fundId) ?? [];
  }
}

// Minimal stand-in for OrderService — just records calls and returns a fake order.
class FakeOrderService {
  public placed: Array<{ userId: string; symbol: string; side: OrderSide; quantity: number }> = [];
  async placeOrder(
    userId: string,
    input: { symbol: string; side: OrderSide; quantity: number },
  ): Promise<Order> {
    this.placed.push({ userId, ...input });
    return {
      id: randomUUID(),
      userId,
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      quantity: String(input.quantity),
      executedPrice: null,
      status: "PENDING",
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Order;
  }
}

function buildSut() {
  const funds = new FakeFundRepository();
  const fundHoldings = new FakeFundHoldingRepository();
  const orderService = new FakeOrderService();
  const service = new FundService(funds, fundHoldings, orderService as unknown as OrderService);
  return { service, funds, fundHoldings, orderService };
}

function seedFund(funds: FakeFundRepository, opts: Partial<Fund> = {}) {
  funds.seed({
    id: FUND_ID,
    name: "Test Fund",
    riskProfile: "moderate",
    isActive: true,
    ...opts,
  } as any);
}

// ════════════════════════════════════════════════════════════════════════════
//  getActiveOrThrow
// ════════════════════════════════════════════════════════════════════════════
describe("FundService.getActiveOrThrow", () => {
  it("returns the fund when active", async () => {
    const { service, funds } = buildSut();
    seedFund(funds);
    const f = await service.getActiveOrThrow(FUND_ID);
    expect(f.id).toBe(FUND_ID);
  });

  it("throws when fund missing", async () => {
    const { service } = buildSut();
    await expect(service.getActiveOrThrow(FUND_ID)).rejects.toThrow(/not found/i);
  });

  it("throws when fund inactive", async () => {
    const { service, funds } = buildSut();
    seedFund(funds, { isActive: false });
    await expect(service.getActiveOrThrow(FUND_ID)).rejects.toThrow(/not found|inactive/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  invest
// ════════════════════════════════════════════════════════════════════════════
describe("FundService.invest", () => {
  it("places one BUY order per holding, sized by targetWeight / stub price", async () => {
    // ── INPUT ─────────────────────────────────────────────────────────
    // fund holdings:  AAPL 60% @ 100, MSFT 40% @ 200
    // invest amount:  1000
    // expected qty:   AAPL = 600/100 = 6,  MSFT = 400/200 = 2
    const { service, funds, fundHoldings, orderService } = buildSut();
    seedFund(funds);
    fundHoldings.seed(FUND_ID, [
      { symbol: "AAPL", targetWeight: 0.6 },
      { symbol: "MSFT", targetWeight: 0.4 },
    ]);

    // ── ACT ───────────────────────────────────────────────────────────
    const placed = await service.invest(USER, FUND_ID, 1000);

    // ── EXPECTED OUTPUT ───────────────────────────────────────────────
    expect(placed).toHaveLength(2);
    expect(orderService.placed).toHaveLength(2);
    const aapl = orderService.placed.find((o) => o.symbol === "AAPL")!;
    const msft = orderService.placed.find((o) => o.symbol === "MSFT")!;
    expect(aapl).toMatchObject({ userId: USER, side: "BUY" });
    expect(msft).toMatchObject({ userId: USER, side: "BUY" });
    expect(aapl.quantity).toBeCloseTo(6, 6);
    expect(msft.quantity).toBeCloseTo(2, 6);
  });

  it("skips holdings whose computed quantity rounds to zero at 6 dp", async () => {
    // amount 0.01,  AAPL 99% @ 100 → qty 0.000099  (non-zero at 6 dp)
    //               NVDA  1% @ 400 → qty 2.5e-7    (rounds to 0)
    const { service, funds, fundHoldings, orderService } = buildSut();
    seedFund(funds);
    fundHoldings.seed(FUND_ID, [
      { symbol: "AAPL", targetWeight: 0.99 },
      { symbol: "NVDA", targetWeight: 0.01 },
    ]);

    const placed = await service.invest(USER, FUND_ID, 0.01);

    expect(placed).toHaveLength(1);
    expect(placed[0].symbol).toBe("AAPL");
    expect(orderService.placed).toHaveLength(1);
    expect(orderService.placed[0].symbol).toBe("AAPL");
  });

  it("throws when fund is not active", async () => {
    const { service, funds } = buildSut();
    seedFund(funds, { isActive: false });
    await expect(service.invest(USER, FUND_ID, 1000)).rejects.toThrow(/not found|inactive/i);
  });

  it("throws when fund has no holdings", async () => {
    const { service, funds } = buildSut();
    seedFund(funds);
    await expect(service.invest(USER, FUND_ID, 1000)).rejects.toThrow(/no holdings/i);
  });

  it("throws when a holding's symbol has no stub price", async () => {
    const { service, funds, fundHoldings } = buildSut();
    seedFund(funds);
    fundHoldings.seed(FUND_ID, [{ symbol: "UNKNOWN", targetWeight: 1.0 }]);
    await expect(service.invest(USER, FUND_ID, 1000)).rejects.toThrow(/no stub price/i);
  });
});
