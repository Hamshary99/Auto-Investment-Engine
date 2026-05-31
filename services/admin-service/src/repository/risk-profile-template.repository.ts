import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { RiskProfileTemplate, RiskProfile } from "@auto-invest/shared";

export class RiskProfileTemplateRepository {
  private repo(tx?: EntityManager): Repository<RiskProfileTemplate> {
    return tx ? tx.getRepository(RiskProfileTemplate) : AppDataSource.getRepository(RiskProfileTemplate);
  }

  findAll(tx?: EntityManager): Promise<RiskProfileTemplate[]> {
    return this.repo(tx).find({
      relations: { productType: true },
      order: { riskProfile: "ASC", productType: { name: "ASC" } },
    });
  }

  findByRiskProfile(riskProfile: RiskProfile, tx?: EntityManager): Promise<RiskProfileTemplate[]> {
    return this.repo(tx).find({
      where: { riskProfile },
      relations: { productType: true },
      order: { productType: { name: "ASC" } },
    });
  }

  save(row: RiskProfileTemplate, tx?: EntityManager): Promise<RiskProfileTemplate> {
    return this.repo(tx).save(row);
  }

  saveMany(rows: RiskProfileTemplate[], tx?: EntityManager): Promise<RiskProfileTemplate[]> {
    return this.repo(tx).save(rows);
  }

  async deleteByRiskProfile(riskProfile: RiskProfile, tx?: EntityManager): Promise<void> {
    await this.repo(tx).delete({ riskProfile });
  }
}
