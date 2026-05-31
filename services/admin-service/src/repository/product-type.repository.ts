import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { ProductType, AssociatedIndexFund } from "@auto-invest/shared";

export class ProductTypeRepository {
  private ptRepo(tx?: EntityManager): Repository<ProductType> {
    return tx ? tx.getRepository(ProductType) : AppDataSource.getRepository(ProductType);
  }

  private aifRepo(tx?: EntityManager): Repository<AssociatedIndexFund> {
    return tx ? tx.getRepository(AssociatedIndexFund) : AppDataSource.getRepository(AssociatedIndexFund);
  }

  findAll(tx?: EntityManager): Promise<ProductType[]> {
    return this.ptRepo(tx).find({
      relations: { associatedIndexFunds: true },
      order: { name: "ASC" },
    });
  }

  findById(id: string, tx?: EntityManager): Promise<ProductType | null> {
    return this.ptRepo(tx).findOne({
      where: { id },
      relations: { associatedIndexFunds: true },
    });
  }

  saveProductType(pt: ProductType, tx?: EntityManager): Promise<ProductType> {
    return this.ptRepo(tx).save(pt);
  }

  createProductType(input: Partial<ProductType>, tx?: EntityManager): Promise<ProductType> {
    const r = this.ptRepo(tx);
    return r.save(r.create(input));
  }

  saveAssociatedIndexFunds(funds: AssociatedIndexFund[], tx?: EntityManager): Promise<AssociatedIndexFund[]> {
    return this.aifRepo(tx).save(funds);
  }

  async deleteAssociatedIndexFundsByProductTypeId(productTypeId: string, tx?: EntityManager): Promise<void> {
    await this.aifRepo(tx).delete({ productType: { id: productTypeId } });
  }
}
