import { RiskProfileTemplateService } from "../src/services/risk-profile-template.service";
import { RiskProfile, RiskProfileTemplate } from "@auto-invest/shared";

describe("RiskProfileTemplateService", () => {
  let service: RiskProfileTemplateService;
  let riskProfileTemplateRepo: any;
  let productTypeRepo: any;
  let dataSource: any;
  let queryBuilder: any;

  beforeEach(() => {
    riskProfileTemplateRepo = {
      findByRiskProfile: jest.fn(),
    };
    productTypeRepo = {
      findActiveByIds: jest.fn(),
    };

    queryBuilder = {
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (cb) => {
        const tx = {
          createQueryBuilder: jest.fn(() => queryBuilder),
          save: jest.fn(async (model, rows) => rows),
        };
        return cb(tx);
      }),
    };

    service = new RiskProfileTemplateService(riskProfileTemplateRepo, productTypeRepo, dataSource);
  });

  describe("getByRiskProfile", () => {
    it("returns templates by risk profile", async () => {
      riskProfileTemplateRepo.findByRiskProfile.mockResolvedValue([{ id: "1" }]);
      const result = await service.getByRiskProfile(RiskProfile.Conservative);
      expect(result).toEqual([{ id: "1" }]);
    });
  });

  describe("replaceTemplateForProfile", () => {
    it("throws error if weights do not sum to 1.0", async () => {
      await expect(service.replaceTemplateForProfile(RiskProfile.Conservative, [{ productTypeId: "1", weight: 0.5 }])).rejects.toThrow("Weights must sum to 1.0");
    });

    it("throws error if product types are inactive or missing", async () => {
      productTypeRepo.findActiveByIds.mockResolvedValue([{ id: "1" }]); // only one found

      await expect(
        service.replaceTemplateForProfile(RiskProfile.Conservative, [
          { productTypeId: "1", weight: 0.5 },
          { productTypeId: "2", weight: 0.5 },
        ])
      ).rejects.toThrow("Some product types are inactive or do not exist: 2");
    });

    it("replaces templates successfully", async () => {
      productTypeRepo.findActiveByIds.mockResolvedValue([
        { id: "1", name: "PT1" },
        { id: "2", name: "PT2" },
      ]);

      const result = await service.replaceTemplateForProfile(RiskProfile.Conservative, [
        { productTypeId: "1", weight: 0.4 },
        { productTypeId: "2", weight: 0.6 },
      ]);

      expect(queryBuilder.delete).toHaveBeenCalled();
      expect(queryBuilder.from).toHaveBeenCalledWith(RiskProfileTemplate);
      expect(queryBuilder.where).toHaveBeenCalledWith("riskProfile = :riskProfile", { riskProfile: RiskProfile.Conservative });
      expect(queryBuilder.execute).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result[0].productType.id).toBe("1");
      expect(result[0].weight).toBe(0.4);
      expect(result[0].riskProfile).toBe(RiskProfile.Conservative);
    });
  });
});
