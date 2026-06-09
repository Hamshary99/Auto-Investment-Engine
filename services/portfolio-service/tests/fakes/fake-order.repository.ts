import { randomUUID } from "crypto";
import { Order } from "../../src/models/order.model";
import { OrderSide, OrderStatus } from "../../src/models/types";
import { OrderRepository } from "../../src/repository/order.repository";

export class FakeOrderRepository extends OrderRepository {
  private byId = new Map<string, Order>();

  async findById(id: string): Promise<Order | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIdForUser(id: string, userId: string): Promise<Order | null> {
    const o = this.byId.get(id);
    return o && o.userId === userId ? o : null;
  }

  async findStuckPending(cutoff: Date): Promise<Order[]> {
    return [...this.byId.values()].filter((o) => o.status === "PENDING" && o.createdAt < cutoff);
  }

  async save(o: Order): Promise<Order> {
    this.byId.set(o.id, o);
    return o;
  }

  async create(input: Partial<Order>): Promise<Order> {
    const o: Order = {
      id: input.id ?? randomUUID(),
      userId: input.userId!,
      symbol: input.symbol!,
      side: input.side!,
      quantity: input.quantity!,
      executedPrice: input.executedPrice ?? null,
      status: input.status ?? OrderStatus.PENDING,
      failureReason: input.failureReason ?? null,
      createdAt: input.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.byId.set(o.id, o);
    return o;
  }

  all(): Order[] { return [...this.byId.values()]; }
  seed(o: Order) { this.byId.set(o.id, o); }
}
