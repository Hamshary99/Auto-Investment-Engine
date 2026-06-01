import { DataSource, EntityManager, In, Repository } from "typeorm";
import { ProductType } from "../models/product-type.model";
import { RiskProfile } from "../models/types";

export class ProductTypeRepository {
  constructor(private dataSource: DataSource) {}

  private repo(tx?: EntityManager): Repository<ProductType> {
    return tx ? tx.getRepository(ProductType) : this.dataSource.getRepository(ProductType);
  }

  findByActive(tx?: EntityManager): Promise<ProductType[]> {
    return this.repo(tx).find({
      where: { isActive: true },
      relations: { associatedIndexFunds: true },
      order: { name: "ASC" },
    });
  }

  findById(id: string, tx?: EntityManager): Promise<ProductType | null> {
    return this.repo(tx).findOne({ where: { id } });
  }

  findByIdActive(id: string, withRelations = false, tx?: EntityManager): Promise<ProductType | null> {
    return this.repo(tx).findOne({
      where: { id, isActive: true },
      relations: withRelations ? { associatedIndexFunds: true } : undefined,
    });
  }

  findActiveByIds(ids: string[], tx?: EntityManager): Promise<ProductType[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.repo(tx).find({ where: { id: In(ids), isActive: true } });
  }

  findByRiskProfile(riskProfile: RiskProfile, tx?: EntityManager): Promise<ProductType[]> {
    return this.repo(tx).find({ where: { riskProfile } });
  }

  save(pt: ProductType, tx?: EntityManager): Promise<ProductType> {
    return this.repo(tx).save(pt);
  }

  create(input: Partial<ProductType>, tx?: EntityManager): Promise<ProductType> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }
}
