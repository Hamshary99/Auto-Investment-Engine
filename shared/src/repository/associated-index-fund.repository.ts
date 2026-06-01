import { DataSource, EntityManager, Repository } from "typeorm";
import { AssociatedIndexFund } from "../models/associated-index-fund.model";

export class AssociatedIndexFundRepository {
  constructor(private dataSource: DataSource) {}

  private repo(tx?: EntityManager): Repository<AssociatedIndexFund> {
    return tx ? tx.getRepository(AssociatedIndexFund) : this.dataSource.getRepository(AssociatedIndexFund);
  }

  findByProductTypeId(productTypeId: string, tx?: EntityManager): Promise<AssociatedIndexFund[]> {
    return this.repo(tx).find({
      where: { productType: { id: productTypeId } },
      relations: { productType: true },
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
