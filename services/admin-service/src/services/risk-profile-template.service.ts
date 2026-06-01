import {
  RiskProfileTemplateRepository,
  ProductTypeRepository,
  RiskProfileTemplate,
  RiskProfile,
} from "@auto-invest/shared";
import { DataSource, EntityManager } from "typeorm";

export class RiskProfileTemplateService {
  constructor(
    private readonly riskProfileTemplateRepo: RiskProfileTemplateRepository,
    private readonly productTypeRepo: ProductTypeRepository,
    private readonly dataSource: DataSource,
  ) {}

  async getByRiskProfile(riskProfile: RiskProfile, tx?: EntityManager): Promise<RiskProfileTemplate[]> {
    return this.riskProfileTemplateRepo.findByRiskProfile(riskProfile, tx as any);
  }

  async replaceTemplateForProfile(
    riskProfile: RiskProfile,
    rows: { productTypeId: string; weight: number }[],
  ): Promise<RiskProfileTemplate[]> {
    const totalWeight = rows.reduce((sum, r) => sum + r.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.01)
      throw new Error(`Weights must sum to 1.0 (±0.01). Got ${totalWeight.toFixed(4)}.`);

    const productTypeIds = rows.map((r) => r.productTypeId);
    const activeProductTypes = await this.productTypeRepo.findActiveByIds(productTypeIds);
    if (activeProductTypes.length !== productTypeIds.length) {
      const foundIds = new Set(activeProductTypes.map((pt) => pt.id));
      const missingIds = productTypeIds.filter((id) => !foundIds.has(id));
      throw new Error(`Some product types are inactive or do not exist: ${missingIds.join(", ")}`);
    }

    return this.dataSource.transaction(async (tx) => {
      await tx
        .createQueryBuilder()
        .delete()
        .from(RiskProfileTemplate)
        .where("riskProfile = :riskProfile", { riskProfile })
        .execute();

      const newRows = rows.map((r) => {
        const pt = activeProductTypes.find((p) => p.id === r.productTypeId)!;
        const template = new RiskProfileTemplate();
        template.riskProfile = riskProfile;
        template.productType = pt;
        template.weight = r.weight;
        return template;
      });

      return tx.save(RiskProfileTemplate, newRows);
    });
  }
}
