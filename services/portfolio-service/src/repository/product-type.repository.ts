import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { ProductType } from "../models/index";
import { RiskProfile } from "../models/product-type.model";

export class ProductTypeRepository {
  private repo(tx?: EntityManager): Repository<ProductType> {
    return tx ? tx.getRepository(ProductType) : AppDataSource.getRepository(ProductType);
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
