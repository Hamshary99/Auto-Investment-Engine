import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { FundHolding } from "../models/index";

export class FundHoldingRepository {
    private repo(tx?: EntityManager): Repository<FundHolding> {
        return tx ? tx.getRepository(FundHolding) : AppDataSource.getRepository(FundHolding);
    }

    findById(id: string, tx?: EntityManager): Promise<FundHolding | null> {
        return this.repo(tx).findOne({ where: { id } });
    }

    findByFundId(fundId: string, tx?: EntityManager): Promise<FundHolding[]> {
        return this.repo(tx).find({ where: { fund: { id: fundId } }, relations: ["fund"] });
    }
    
    save(fundHolding: FundHolding, tx?: EntityManager): Promise<FundHolding> {
        return this.repo(tx).save(fundHolding);
    }

    create(fundHolding: Partial<FundHolding>, tx?: EntityManager): Promise<FundHolding> {
        const entity = this.repo(tx).create(fundHolding);
        return this.repo(tx).save(entity);
    }

    delete(id: string, tx?: EntityManager): Promise<void> {
        return this.repo(tx).delete(id).then(() => { });
    }
}