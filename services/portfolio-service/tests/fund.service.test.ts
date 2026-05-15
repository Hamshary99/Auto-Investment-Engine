jest.mock("../src/data-source", () => ({
  AppDataSource: {
    transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)),
  },
}));

jest.mock("../src/services/price.stub", () => ({
  getStubPrice: (symbol: string) => {
    // Includes the spec's verification prices (AAPL=180, MSFT=400) alongside
    // round numbers used by other test cases.
    const map: Record<string, number> = {
      AAPL: 180, MSFT: 400, NVDA: 400,
      AAPL_R: 100, MSFT_R: 200,
    };
    const p = map[symbol];
    if (p == null) throw new Error(`no stub price for ${symbol}`);
    return p;
  },
}));

import { randomUUID } from "crypto";
import { FundService } from "../src/services/fund.service";
import { FundRepository } from "../src/repository/fund.repository";
import { FundAllocationRepository } from "../src/repository/fund-allocation.repository";
import { FundInvestmentRepository } from "../src/repository/fund-investment.repository";
import { PortfolioRepository } from "../src/repository/portfolio.repository";
import { OrderService } from "../src/services/order.service";
import { Fund } from "../src/models/fund.model";
import { FundAllocation } from "../src/models/fund-allocation.model";
import { FundInvestment } from "../src/models/fund-investment.model";
import { Portfolio } from "../src/models/portfolio.model";
import { Order, OrderSide } from "../src/models/order.model";

const USER = "11111111-1111-1111-1111-111111111111";
const FUND_ID = "22222222-2222-2222-2222-222222222222";
const PORTFOLIO_ID = "33333333-3333-3333-3333-333333333333";

class FakeFundRepository extends FundRepository {
  private byId = new Map<string, Fund>();
  seed(f: Partial<Fund> & { id: string }) { this.byId.set(f.id, f as Fund); }
  async findByActive() { return [...this.byId.values()].filter((f) => f.isActive); }
  async findById(id: string) { return this.byId.get(id) ?? null; }
  async findByIdActive(id: string, isActive: boolean) {
    const f = this.byId.get(id);
    return f && f.isActive === isActive ? f : null;
  }
}

class FakeFundAllocationRepository extends FundAllocationRepository {
  private byFund = new Map<string, FundAllocation[]>();
  seed(fundId: string, rows: Array<{ symbol: string; targetWeight: number }>) {
    this.byFund.set(
      fundId,
      rows.map((r) => ({
        id: randomUUID(),
        symbol: r.symbol,
        targetWeight: r.targetWeight,
        fund: { id: fundId } as Fund,
      })),
    );
  }
  async findByFundId(fundId: string) { return this.byFund.get(fundId) ?? []; }
}

class FakeFundInvestmentRepository extends FundInvestmentRepository {
  public rows: FundInvestment[] = [];
  private find(portfolioId: string, fundId: string) {
    return this.rows.find((r) => r.portfolio.id === portfolioId && r.fund.id === fundId);
  }
  async findByPortfolioAndFund(portfolioId: string, fundId: string) {
    return this.find(portfolioId, fundId) ?? null;
  }
  async addInvestment(portfolioId: string, fundId: string, amount: number) {
    const existing = this.find(portfolioId, fundId);
    if (existing) {
      existing.investedAmount = (Number(existing.investedAmount) + amount).toFixed(2);
      return existing;
    }
    const row = {
      id: randomUUID(),
      portfolio: { id: portfolioId } as Portfolio,
      fund: { id: fundId } as Fund,
      investedAmount: amount.toFixed(2),
      withdrawnAmount: "0.00",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as FundInvestment;
    this.rows.push(row);
    return row;
  }
  async addWithdrawal(portfolioId: string, fundId: string, amount: number) {
    const existing = this.find(portfolioId, fundId);
    if (!existing) throw new Error("no fund_investment row exists for this (portfolio, fund)");
    existing.withdrawnAmount = (Number(existing.withdrawnAmount) + amount).toFixed(2);
    return existing;
  }
}

class FakePortfolioRepository extends PortfolioRepository {
  private byUser = new Map<string, Portfolio>();
  seed(p: Portfolio) { this.byUser.set(p.userId, p); }
  async findByUserId(userId: string) { return this.byUser.get(userId) ?? null; }
}

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
  const allocations = new FakeFundAllocationRepository();
  const fundInvestments = new FakeFundInvestmentRepository();
  const portfolios = new FakePortfolioRepository();
  const orderService = new FakeOrderService();
  // seed a portfolio for USER so fund_investments upsert can resolve it
  portfolios.seed({
    id: PORTFOLIO_ID,
    userId: USER,
    cashBalance: "100000.00",
    holdings: [],
    createdAt: new Date(),
  } as Portfolio);

  const service = new FundService(
    funds,
    allocations,
    fundInvestments,
    portfolios,
    orderService as unknown as OrderService,
  );
  return { service, funds, allocations, fundInvestments, portfolios, orderService };
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
    expect((await service.getActiveOrThrow(FUND_ID)).id).toBe(FUND_ID);
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
  it("places one BUY order per allocation and records the fund_investment", async () => {
    // ── SPEC EXAMPLE ──────────────────────────────────────────────────
    // Tech Growth Fund:  AAPL 60% @ $180,  MSFT 40% @ $400
    // Portfolio invests $1000  →  expected:
    //   BUY ~$600 AAPL  →  600/180 = 3.333333 shares
    //   BUY ~$400 MSFT  →  400/400 = 1.000000 shares
    //   fund_investments(portfolio, fund) = $1000.00
    const { service, funds, allocations, fundInvestments, orderService } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [
      { symbol: "AAPL", targetWeight: 0.6 },
      { symbol: "MSFT", targetWeight: 0.4 },
    ]);

    const placed = await service.invest(USER, FUND_ID, 1000);

    expect(placed).toHaveLength(2);
    const aapl = orderService.placed.find((o) => o.symbol === "AAPL")!;
    const msft = orderService.placed.find((o) => o.symbol === "MSFT")!;
    expect(aapl.quantity).toBeCloseTo(3.333333, 6);
    expect(msft.quantity).toBeCloseTo(1.0, 6);

    expect(fundInvestments.rows).toHaveLength(1);
    expect(fundInvestments.rows[0]).toMatchObject({
      portfolio: { id: PORTFOLIO_ID },
      fund: { id: FUND_ID },
      investedAmount: "1000.00",
    });
  });

  it("accumulates investedAmount across multiple invests into the same fund", async () => {
    const { service, funds, allocations, fundInvestments } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [{ symbol: "AAPL", targetWeight: 1.0 }]);

    await service.invest(USER, FUND_ID, 1000);
    await service.invest(USER, FUND_ID, 500);

    expect(fundInvestments.rows).toHaveLength(1);
    expect(fundInvestments.rows[0].investedAmount).toBe("1500.00");
  });

  it("skips allocations whose computed quantity rounds to zero at 6 dp", async () => {
    const { service, funds, allocations, orderService } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [
      { symbol: "AAPL", targetWeight: 0.99 },
      { symbol: "NVDA", targetWeight: 0.01 },
    ]);

    const placed = await service.invest(USER, FUND_ID, 0.01);
    expect(placed).toHaveLength(1);
    expect(placed[0].symbol).toBe("AAPL");
    expect(orderService.placed).toHaveLength(1);
  });

  it("throws when fund inactive", async () => {
    const { service, funds } = buildSut();
    seedFund(funds, { isActive: false });
    await expect(service.invest(USER, FUND_ID, 1000)).rejects.toThrow(/not found|inactive/i);
  });

  it("throws when fund has no allocations", async () => {
    const { service, funds } = buildSut();
    seedFund(funds);
    await expect(service.invest(USER, FUND_ID, 1000)).rejects.toThrow(/no allocations/i);
  });

  it("throws when allocation symbol has no stub price", async () => {
    const { service, funds, allocations } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [{ symbol: "UNKNOWN", targetWeight: 1.0 }]);
    await expect(service.invest(USER, FUND_ID, 1000)).rejects.toThrow(/no stub price/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  withdraw
// ════════════════════════════════════════════════════════════════════════════
describe("FundService.withdraw", () => {
  it("places one SELL per allocation and increments withdrawnAmount", async () => {
    // Setup: invest $1000 first so a fund_investment row exists.
    // Then withdraw $400  →  AAPL 240/180 = 1.333333 sold, MSFT 160/400 = 0.4 sold.
    const { service, funds, allocations, fundInvestments, orderService } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [
      { symbol: "AAPL", targetWeight: 0.6 },
      { symbol: "MSFT", targetWeight: 0.4 },
    ]);

    await service.invest(USER, FUND_ID, 1000);
    orderService.placed.length = 0; // clear so we only inspect the withdraw orders

    const placed = await service.withdraw(USER, FUND_ID, 400);

    expect(placed).toHaveLength(2);
    expect(placed.every((o) => o.side === "SELL")).toBe(true);
    const aapl = orderService.placed.find((o) => o.symbol === "AAPL")!;
    const msft = orderService.placed.find((o) => o.symbol === "MSFT")!;
    expect(aapl.side).toBe("SELL");
    expect(msft.side).toBe("SELL");
    expect(aapl.quantity).toBeCloseTo(1.333333, 6);
    expect(msft.quantity).toBeCloseTo(0.4, 6);

    expect(fundInvestments.rows).toHaveLength(1);
    expect(fundInvestments.rows[0]).toMatchObject({
      investedAmount: "1000.00",
      withdrawnAmount: "400.00",
    });
  });

  it("accumulates withdrawnAmount across multiple withdrawals", async () => {
    const { service, funds, allocations, fundInvestments } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [{ symbol: "AAPL", targetWeight: 1.0 }]);

    await service.invest(USER, FUND_ID, 1000);
    await service.withdraw(USER, FUND_ID, 200);
    await service.withdraw(USER, FUND_ID, 150);

    expect(fundInvestments.rows[0]).toMatchObject({
      investedAmount: "1000.00",
      withdrawnAmount: "350.00",
    });
  });

  it("throws when withdrawing from a fund the portfolio never invested in", async () => {
    const { service, funds, allocations } = buildSut();
    seedFund(funds);
    allocations.seed(FUND_ID, [{ symbol: "AAPL", targetWeight: 1.0 }]);

    await expect(service.withdraw(USER, FUND_ID, 100)).rejects.toThrow(
      /no investment in this fund/i,
    );
  });

  it("throws when fund inactive", async () => {
    const { service, funds } = buildSut();
    seedFund(funds, { isActive: false });
    await expect(service.withdraw(USER, FUND_ID, 100)).rejects.toThrow(/not found|inactive/i);
  });
});
