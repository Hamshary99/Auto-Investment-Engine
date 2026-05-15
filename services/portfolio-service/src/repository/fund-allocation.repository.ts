import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { FundAllocation } from "../models/index";

export class FundAllocationRepository {
  private repo(tx?: EntityManager): Repository<FundAllocation> {
    return tx ? tx.getRepository(FundAllocation) : AppDataSource.getRepository(FundAllocation);
  }

  findById(id: string, tx?: EntityManager): Promise<FundAllocation | null> {
    return this.repo(tx).findOne({ where: { id } });
  }

  findByFundId(fundId: string, tx?: EntityManager): Promise<FundAllocation[]> {
    return this.repo(tx).find({ where: { fund: { id: fundId } }, relations: ["fund"] });
  }

  save(allocation: FundAllocation, tx?: EntityManager): Promise<FundAllocation> {
    return this.repo(tx).save(allocation);
  }

  create(allocation: Partial<FundAllocation>, tx?: EntityManager): Promise<FundAllocation> {
    const r = this.repo(tx);
    return r.save(r.create(allocation));
  }

  delete(id: string, tx?: EntityManager): Promise<void> {
    return this.repo(tx).delete(id).then(() => {});
  }
}
