import { DataSource, EntityManager, Repository } from "typeorm";
import { RiskProfile } from "../models/types";
import { RiskProfileTemplate } from "../models/risk-profile-template.model";

export class RiskProfileTemplateRepository {
  constructor(private dataSource: DataSource) {}

  private repo(tx?: EntityManager): Repository<RiskProfileTemplate> {
    return tx
      ? tx.getRepository(RiskProfileTemplate)
      : this.dataSource.getRepository(RiskProfileTemplate);
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
