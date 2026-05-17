import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { AssociatedIndexFund } from "../models/index";

export class AssociatedIndexFundRepository {
  private repo(tx?: EntityManager): Repository<AssociatedIndexFund> {
    return tx ? tx.getRepository(AssociatedIndexFund) : AppDataSource.getRepository(AssociatedIndexFund);
  }

  findByProductTypeId(productTypeId: string, tx?: EntityManager): Promise<AssociatedIndexFund[]> {
    return this.repo(tx).find({
      where: { productType: { id: productTypeId } },
      relations: ["productType"],
    });
  }

  save(row: AssociatedIndexFund, tx?: EntityManager): Promise<AssociatedIndexFund> {
    return this.repo(tx).save(row);
  }

  create(row: Partial<AssociatedIndexFund>, tx?: EntityManager): Promise<AssociatedIndexFund> {
    const r = this.repo(tx);
    return r.save(r.create(row));
  }
}
