import { EntityManager, Repository, } from "typeorm";
import { AppDataSource } from "../data-source";
import { Fund } from "../models/index";
import { RiskProfile } from "../models/fund.model";

export class FundRepository {
    private repo(tx?: EntityManager): Repository<Fund> {
        return tx ? tx.getRepository(Fund) : AppDataSource.getRepository(Fund);
    }

    findByActive( tx?: EntityManager): Promise<Fund[]> {
        return this.repo(tx).find({ where: { isActive: true } });
    }

    findById(id: string, tx?: EntityManager): Promise<Fund | null> {
        return this.repo(tx).findOne({ where: { id } });
    }

    findByIdActive(id: string, isActive: boolean, tx?: EntityManager): Promise<Fund | null> {
        return this.repo(tx).findOne({ where: { id, isActive } });
    }

    findByRiskProfile(riskProfile: RiskProfile, tx?: EntityManager): Promise<Fund[]> {
        return this.repo(tx).find({ where: { riskProfile } });
    }

    save(f: Fund, tx?: EntityManager): Promise<Fund> {
        return this.repo(tx).save(f);
    }

    create(input: Partial<Fund>, tx?: EntityManager): Promise<Fund> {
        const r = this.repo(tx);
        return r.save(r.create(input));
    }

}