import { EntityManager, LessThan, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { Order, OrderStatus } from "../models/index";

export class OrderRepository {
  private repo(tx?: EntityManager): Repository<Order> {
    return tx ? tx.getRepository(Order) : AppDataSource.getRepository(Order);
  }

  findById(id: string, tx?: EntityManager): Promise<Order | null> {
    return this.repo(tx).findOne({ where: { id } });
  }

  findByIdForUser(
    id: string,
    userId: string,
    tx?: EntityManager,
  ): Promise<Order | null> {
    return this.repo(tx).findOne({ where: { id, userId } });
  }

  findStuckPending(cutoff: Date, tx?: EntityManager): Promise<Order[]> {
    return this.repo(tx).find({
      where: { status: OrderStatus.PENDING, createdAt: LessThan(cutoff) },
    });
  }

  placeOrder(order: Partial<Order>, tx?: EntityManager): Promise<Order> {
    const o = this.repo(tx).create(order);
    return this.repo(tx).save(o);
  }

  save(o: Order, tx?: EntityManager): Promise<Order> {
    return this.repo(tx).save(o);
  }

  create(input: Partial<Order>, tx?: EntityManager): Promise<Order> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }
}
