import {
  FundRepository,
  FundHoldingRepository,
} from "../repository/index";
import { Decimal } from "decimal.js";
import { Fund, Order } from "../models/index";
import { getStubPrice } from "./price.stub";
import { OrderService } from "./order.service";

export class FundService {
  constructor(
    private readonly funds: FundRepository,
    private readonly fundHoldings: FundHoldingRepository,
    private readonly orderService: OrderService,
  ) {}

  listActiveFunds(): Promise<Fund[]> {
    return this.funds.findByActive();
  }

  async getActiveOrThrow(id: string): Promise<Fund> {
    const fund = await this.funds.findByIdActive(id, true);
    if (!fund) throw new Error("fund not found or inactive");
    return fund;
  }

  async invest(userId: string, fundId: string, amount: number): Promise<Order[]> {
    await this.getActiveOrThrow(fundId);

    const holdings = await this.fundHoldings.findByFundId(fundId);
    if (!holdings.length) throw new Error("fund has no holdings");

    const total = new Decimal(amount);
    const orders: Order[] = [];

    for (const h of holdings) {
      const weight = new Decimal(h.targetWeight);
      const allocation = total.mul(weight);
      const price = new Decimal(getStubPrice(h.symbol));
      const quantity = allocation.div(price).toDecimalPlaces(6, Decimal.ROUND_DOWN);

      if (quantity.lte(0)) continue;

      const order = await this.orderService.placeOrder(userId, {
        symbol: h.symbol,
        side: "BUY",
        quantity: quantity.toNumber(),
      });
      orders.push(order);
    }

    return orders;
  }
}
