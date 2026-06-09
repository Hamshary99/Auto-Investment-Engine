import {
  SubscribedPortfolioRepository,
  UserPortfolioRepository,
  AutoInvestPlanRepository,
} from "../repository/index";
import { ProductTypeRepository, AssociatedIndexFundRepository } from "@auto-invest/shared";
import { Decimal } from "decimal.js";
import { Order, OrderSide, ProductType } from "../models/index";
import { getStubPrice } from "./price.stub";
import { OrderService } from "./order.service";
import { ApiError } from "../utils/error.handler";


export class SubscribedPortfolioService {
  constructor(
    private readonly productTypes: ProductTypeRepository,
    private readonly associatedIndexFunds: AssociatedIndexFundRepository,
    private readonly subscribedPortfolios: SubscribedPortfolioRepository,
    private readonly userPortfolios: UserPortfolioRepository,
    private readonly autoInvestPlans: AutoInvestPlanRepository,
    private readonly orderService: OrderService,
  ) {}

  listActiveProductTypes(): Promise<ProductType[]> {
    return this.productTypes.findByActive();
  }

  async getActiveProductTypeOrThrow(id: string): Promise<ProductType> {
    const pt = await this.productTypes.findByIdActive(id, true);
    if (!pt) throw new ApiError("product type not found or inactive", 404);
    return pt;
  }

  /**
   * addMoreFund — deploy `amount` from user cash into a product type's index-fund mix.
   */
  async addFund(userId: string, productTypeId: string, amount: number, reservePct: number = 0.01, planId?: string): Promise<Order[]> {
    await this.getActiveProductTypeOrThrow(productTypeId);

    const mix = await this.associatedIndexFunds.findByProductTypeId(productTypeId);
    if (!mix.length) throw new Error("product type has no associated index funds");

    const userPortfolio = await this.userPortfolios.findByUserId(userId);
    if (!userPortfolio) throw new Error("user portfolio not found");

    let cashObj: { cashBalance: string } = userPortfolio;
    if (planId) {
      const plan = await this.autoInvestPlans.findById(planId);
      if (!plan) throw new Error("plan not found");
      cashObj = plan;
    }

    const cash = new Decimal(cashObj.cashBalance);
    const investable = cash.mul(1 - reservePct);

    if (new Decimal(amount).gt(investable)) {
      throw new Error(`Cannot invest ${amount}: exceeds investable limit of ${investable.toFixed(2)}`);
    }

    const total = new Decimal(amount);
    const orders: Order[] = [];

    for (const row of mix) {
      const weight = new Decimal(row.targetWeight);
      const slice = total.mul(weight);
      const price = new Decimal(getStubPrice(row.symbol));
      const quantity = slice.div(price).toDecimalPlaces(6, Decimal.ROUND_DOWN);

      if (quantity.lte(0)) continue;

      const order = await this.orderService.placeOrder(userId, {
        symbol: row.symbol,
        side: OrderSide.BUY,
        quantity: quantity.toNumber(),
        planId,
      });
      orders.push(order);
    }

    if (orders.length) {
      await this.subscribedPortfolios.recordAddFund(userPortfolio.id, productTypeId, amount, planId || null);
    }

    return orders;
  }

  /**
   * redeem — sell proportionally across the product type's index-fund mix.
   */
  async redeem(userId: string, productTypeId: string, amount: number, planId?: string): Promise<Order[]> {
    await this.getActiveProductTypeOrThrow(productTypeId);

    const mix = await this.associatedIndexFunds.findByProductTypeId(productTypeId);
    if (!mix.length) throw new Error("product type has no associated index funds");

    const userPortfolio = await this.userPortfolios.findByUserId(userId);
    if (!userPortfolio) throw new Error("user portfolio not found");

    const subscription = await this.subscribedPortfolios.findByUserPortfolioAndProductType(
      userPortfolio.id,
      productTypeId,
      planId || null,
    );
    if (!subscription) {
      throw new Error("no subscription to this product type to redeem from");
    }

    const total = new Decimal(amount);
    const orders: Order[] = [];

    for (const row of mix) {
      const weight = new Decimal(row.targetWeight);
      const slice = total.mul(weight);
      const price = new Decimal(getStubPrice(row.symbol));
      const quantity = slice.div(price).toDecimalPlaces(6, Decimal.ROUND_DOWN);

      if (quantity.lte(0)) continue;

      const order = await this.orderService.placeOrder(userId, {
        symbol: row.symbol,
        side: OrderSide.SELL,
        quantity: quantity.toNumber(),
        planId,
      });
      orders.push(order);
    }

    if (orders.length) {
      await this.subscribedPortfolios.recordRedemption(userPortfolio.id, productTypeId, amount, planId || null);
    }

    return orders;
  }

  /**
   * withdrawFromPlan — liquidates a specified amount from an AutoInvestPlan proportionally across its allocations.
   */
  async withdrawFromPlan(userId: string, planId: string, amount: number): Promise<Order[]> {
    const plan = await this.autoInvestPlans.findById(planId);
    if (!plan || plan.userId !== userId) {
      throw new ApiError("Investment plan not found", 404, "not_found");
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError("Amount must be positive", 400, "invalid_input");
    }

    // Pro-rata based on target weight of the plan's allocations
    // For a more exact withdrawal, we should look at current value, but target weight is a proxy
    const total = new Decimal(amount);
    const orders: Order[] = [];

    for (const alloc of plan.allocations) {
      const slice = total.mul(alloc.weight).toNumber();
      if (slice <= 0) continue;
      
      const allocOrders = await this.redeem(userId, alloc.productType.id, slice, planId);
      orders.push(...allocOrders);
    }

    return orders;
  }
}
