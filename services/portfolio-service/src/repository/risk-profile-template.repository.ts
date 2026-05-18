import { EntityManager, Repository } from "typeorm";
import { AppDataSource } from "../data-source";
import { RiskProfile } from "../models/types";
import { RiskProfileTemplate } from "../models/risk-profile-template.model";

export class RiskProfileTemplateRepository {
  private repo(tx?: EntityManager): Repository<RiskProfileTemplate> {
    return tx
      ? tx.getRepository(RiskProfileTemplate)
      : AppDataSource.getRepository(RiskProfileTemplate);
  }

  findByRiskProfile(
    riskProfile: RiskProfile,
    tx?: EntityManager,
  ): Promise<RiskProfileTemplate[]> {
    return this.repo(tx).find({
      where: { riskProfile },
      relations: { productType: true },
      order: { productType: { name: "ASC" } },
    });
  }

  save(
    row: RiskProfileTemplate,
    tx?: EntityManager,
  ): Promise<RiskProfileTemplate> {
    return this.repo(tx).save(row);
  }

  create(
    input: Partial<RiskProfileTemplate>,
    tx?: EntityManager,
  ): Promise<RiskProfileTemplate> {
    const r = this.repo(tx);
    return r.save(r.create(input));
  }
}
