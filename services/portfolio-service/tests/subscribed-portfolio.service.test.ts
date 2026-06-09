jest.mock("../src/data-source", () => ({
  AppDataSource: {
    transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(undefined)),
  },
}));

jest.mock("../src/services/price.stub", () => ({
  getStubPrice: (symbol: string) => {
    const map: Record<string, number> = {
      AAPL: 180,
      MSFT: 400,
      NVDA: 400,
      AAPL_R: 100,
      MSFT_R: 200,
    };
    const p = map[symbol];
    if (p == null) throw new Error(`no stub price for ${symbol}`);
    return p;
  },
}));

import { randomUUID } from "crypto";
import { SubscribedPortfolioService } from "../src/services/subscribed-portfolio.service";
import { ProductTypeRepository, AssociatedIndexFundRepository } from "@auto-invest/shared";
import { SubscribedPortfolioRepository } from "../src/repository/subscribed-portfolio.repository";
import { UserPortfolioRepository } from "../src/repository/user-portfolio.repository";
import { OrderService } from "../src/services/order.service";
import { ProductType, AssociatedIndexFund } from "@auto-invest/shared";
import { SubscribedPortfolio } from "../src/models/subscribed-portfolio.model";
import { UserPortfolio } from "../src/models/user-portfolio.model";
import { Order } from "../src/models/order.model";
import { OrderSide } from "../src/models/types";

const USER = "11111111-1111-1111-1111-111111111111";
const PRODUCT_TYPE_ID = "22222222-2222-2222-2222-222222222222";
const USER_PORTFOLIO_ID = "33333333-3333-3333-3333-333333333333";

class FakeProductTypeRepository extends ProductTypeRepository {
  private byId = new Map<string, ProductType>();
  seed(pt: Partial<ProductType> & { id: string }) {
    this.byId.set(pt.id, pt as ProductType);
  }
  async findByActive() {
    return [...this.byId.values()].filter((f) => f.isActive);
  }
  async findByIdActive(id: string, _withRelations: boolean) {
    const f = this.byId.get(id);
    return f?.isActive ? f : null;
  }
}

class FakeAssociatedIndexFundRepository extends AssociatedIndexFundRepository {
  private byProductType = new Map<string, AssociatedIndexFund[]>();
  seed(productTypeId: string, rows: Array<{ symbol: string; targetWeight: number }>) {
    this.byProductType.set(
      productTypeId,
      rows.map((r) => ({
        id: randomUUID(),
        symbol: r.symbol,
        targetWeight: r.targetWeight,
        productType: { id: productTypeId } as ProductType,
      })),
    );
  }
  async findByProductTypeId(productTypeId: string) {
    return this.byProductType.get(productTypeId) ?? [];
  }
}

class FakeSubscribedPortfolioRepository extends SubscribedPortfolioRepository {
  public rows: SubscribedPortfolio[] = [];
  private find(userPortfolioId: string, productTypeId: string, planId: string | null) {
    return this.rows.find(
      (r) => r.userPortfolio.id === userPortfolioId && r.productType.id === productTypeId && (r.planId || null) === (planId || null),
    );
  }
  async findByUserPortfolioAndProductType(userPortfolioId: string, productTypeId: string, planId: string | null = null) {
    return this.find(userPortfolioId, productTypeId, planId) ?? null;
  }
  async recordAddFund(userPortfolioId: string, productTypeId: string, amount: number, planId: string | null = null) {
    const existing = this.find(userPortfolioId, productTypeId, planId);
    if (existing) {
      existing.investedAmount = (Number(existing.investedAmount) + amount).toFixed(2);
      return existing;
    }
    const row = {
      id: randomUUID(),
      userPortfolio: { id: userPortfolioId } as UserPortfolio,
      productType: { id: productTypeId } as ProductType,
      investedAmount: amount.toFixed(2),
      redeemedAmount: "0.00",
      planId: planId,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as SubscribedPortfolio;
    this.rows.push(row);
    return row;
  }
  async recordRedemption(userPortfolioId: string, productTypeId: string, amount: number, planId: string | null = null) {
    const existing = this.find(userPortfolioId, productTypeId, planId);
    if (!existing) throw new Error("no subscribed_portfolio row");
    existing.redeemedAmount = (Number(existing.redeemedAmount) + amount).toFixed(2);
    return existing;
  }
}

class FakeUserPortfolioRepository extends UserPortfolioRepository {
  private byUser = new Map<string, UserPortfolio>();
  seed(p: UserPortfolio) {
    this.byUser.set(p.userId, p);
  }
  async findByUserId(userId: string) {
    return this.byUser.get(userId) ?? null;
  }
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
  const productTypes = new FakeProductTypeRepository({} as any);
  const associatedIndexFunds = new FakeAssociatedIndexFundRepository({} as any);
  const subscribedPortfolios = new FakeSubscribedPortfolioRepository();
  const userPortfolios = new FakeUserPortfolioRepository();
  const orderService = new FakeOrderService();
  userPortfolios.seed({
    id: USER_PORTFOLIO_ID,
    userId: USER,
    cashBalance: "100000.00",
    holdings: [],
    createdAt: new Date(),
  } as UserPortfolio);

  const service = new SubscribedPortfolioService(
    productTypes,
    associatedIndexFunds,
    subscribedPortfolios,
    userPortfolios,
    {} as any,
    orderService as unknown as OrderService,
  );
  return { service, productTypes, associatedIndexFunds, subscribedPortfolios, orderService };
}

function seedProductType(productTypes: FakeProductTypeRepository, opts: Partial<ProductType> = {}) {
  productTypes.seed({
    id: PRODUCT_TYPE_ID,
    name: "Savings",
    riskProfile: "moderate",
    isActive: true,
    ...opts,
  } as any);
}

describe("SubscribedPortfolioService.getActiveProductTypeOrThrow", () => {
  it("returns the product type when active", async () => {
    const { service, productTypes } = buildSut();
    seedProductType(productTypes);
    expect((await service.getActiveProductTypeOrThrow(PRODUCT_TYPE_ID)).id).toBe(PRODUCT_TYPE_ID);
  });

  it("throws when product type missing or inactive", async () => {
    const { service, productTypes } = buildSut();
    seedProductType(productTypes, { isActive: false });
    await expect(service.getActiveProductTypeOrThrow(PRODUCT_TYPE_ID)).rejects.toThrow(/not found/i);
  });
});

describe("SubscribedPortfolioService.addFund", () => {
  it("places BUY orders per associated index fund and records subscription", async () => {
    const { service, productTypes, associatedIndexFunds, subscribedPortfolios, orderService } =
      buildSut();
    seedProductType(productTypes);
    associatedIndexFunds.seed(PRODUCT_TYPE_ID, [
      { symbol: "AAPL", targetWeight: 0.6 },
      { symbol: "MSFT", targetWeight: 0.4 },
    ]);

    const placed = await service.addFund(USER, PRODUCT_TYPE_ID, 1000);

    expect(placed).toHaveLength(2);
    expect(orderService.placed.find((o) => o.symbol === "AAPL")!.quantity).toBeCloseTo(3.333333, 6);
    expect(subscribedPortfolios.rows[0]).toMatchObject({
      userPortfolio: { id: USER_PORTFOLIO_ID },
      productType: { id: PRODUCT_TYPE_ID },
      investedAmount: "1000.00",
    });
  });

  it("throws when product type has no associated index funds", async () => {
    const { service, productTypes } = buildSut();
    seedProductType(productTypes);
    await expect(service.addFund(USER, PRODUCT_TYPE_ID, 1000)).rejects.toThrow(
      /no associated index funds/i,
    );
  });
});

describe("SubscribedPortfolioService.redeem", () => {
  it("places SELL orders and increments redeemedAmount", async () => {
    const { service, productTypes, associatedIndexFunds, subscribedPortfolios } = buildSut();
    seedProductType(productTypes);
    associatedIndexFunds.seed(PRODUCT_TYPE_ID, [
      { symbol: "AAPL", targetWeight: 0.6 },
      { symbol: "MSFT", targetWeight: 0.4 },
    ]);

    await service.addFund(USER, PRODUCT_TYPE_ID, 1000);
    const placed = await service.redeem(USER, PRODUCT_TYPE_ID, 400);

    expect(placed).toHaveLength(2);
    expect(placed.every((o) => o.side === "SELL")).toBe(true);
    expect(subscribedPortfolios.rows[0].redeemedAmount).toBe("400.00");
  });

  it("throws when no subscription exists", async () => {
    const { service, productTypes, associatedIndexFunds } = buildSut();
    seedProductType(productTypes);
    associatedIndexFunds.seed(PRODUCT_TYPE_ID, [{ symbol: "AAPL", targetWeight: 1.0 }]);
    await expect(service.redeem(USER, PRODUCT_TYPE_ID, 100)).rejects.toThrow(/no subscription/i);
  });
});
