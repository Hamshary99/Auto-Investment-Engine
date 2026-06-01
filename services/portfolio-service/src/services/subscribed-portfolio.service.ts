import {
  SubscribedPortfolioRepository,
  UserPortfolioRepository,
} from "../repository/index";
import { ProductTypeRepository, AssociatedIndexFundRepository } from "@auto-invest/shared";
import { Decimal } from "decimal.js";
import { Order, OrderSide, ProductType } from "../models/index";
import { getStubPrice } from "./price.stub";
import { OrderService } from "./order.service";
import { ApiError } from "../utils/error.handler";

/**
 * Subscribed-portfolio operations (Madkhol: subscribe, addMoreFund, redeem).
 */
export class SubscribedPortfolioService {
  constructor(
    private readonly productTypes: ProductTypeRepository,
    private readonly associatedIndexFunds: AssociatedIndexFundRepository,
    private readonly subscribedPortfolios: SubscribedPortfolioRepository,
    private readonly userPortfolios: UserPortfolioRepository,
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
  async addFund(userId: string, productTypeId: string, amount: number): Promise<Order[]> {
    await this.getActiveProductTypeOrThrow(productTypeId);

    const mix = await this.associatedIndexFunds.findByProductTypeId(productTypeId);
    if (!mix.length) throw new Error("product type has no associated index funds");

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
      });
      orders.push(order);
    }

    if (orders.length) {
      const userPortfolio = await this.userPortfolios.findByUserId(userId);
      if (userPortfolio) {
        await this.subscribedPortfolios.recordAddFund(userPortfolio.id, productTypeId, amount);
      }
    }

    return orders;
  }

  /**
   * redeem — sell proportionally across the product type's index-fund mix.
   */
  async redeem(userId: string, productTypeId: string, amount: number): Promise<Order[]> {
    await this.getActiveProductTypeOrThrow(productTypeId);

    const mix = await this.associatedIndexFunds.findByProductTypeId(productTypeId);
    if (!mix.length) throw new Error("product type has no associated index funds");

    const userPortfolio = await this.userPortfolios.findByUserId(userId);
    if (!userPortfolio) throw new Error("user portfolio not found");

    const subscription = await this.subscribedPortfolios.findByUserPortfolioAndProductType(
      userPortfolio.id,
      productTypeId,
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
      });
      orders.push(order);
    }

    if (orders.length) {
      await this.subscribedPortfolios.recordRedemption(userPortfolio.id, productTypeId, amount);
    }

    return orders;
  }
}
