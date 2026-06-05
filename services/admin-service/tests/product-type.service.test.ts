import { ProductTypeService } from "../src/services/product-type.service";
import { RiskProfile } from "@auto-invest/shared";

describe("ProductTypeService", () => {
  let service: ProductTypeService;
  let productTypeRepo: any;
  let associatedIndexFundRepo: any;

  beforeEach(() => {
    productTypeRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByActive: jest.fn(),
      findByNameForDuplicates: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    associatedIndexFundRepo = {};

    service = new ProductTypeService(productTypeRepo, associatedIndexFundRepo);
  });

  describe("getProductTypeById", () => {
    it("returns product type by id", async () => {
      productTypeRepo.findById.mockResolvedValue({ id: "1", name: "PT1" });
      const result = await service.getProductTypeById("1");
      expect(result).toEqual({ id: "1", name: "PT1" });
      expect(productTypeRepo.findById).toHaveBeenCalledWith("1", undefined);
    });
  });

  describe("getAll", () => {
    it("returns all product types", async () => {
      productTypeRepo.findAll.mockResolvedValue([{ id: "1" }]);
      const result = await service.getAll();
      expect(result).toEqual([{ id: "1" }]);
    });
  });

  describe("getAllActive", () => {
    it("returns active product types", async () => {
      productTypeRepo.findByActive.mockResolvedValue([{ id: "2" }]);
      const result = await service.getAllActive();
      expect(result).toEqual([{ id: "2" }]);
    });
  });

  describe("createProductType", () => {
    it("throws error if name is too long", async () => {
      await expect(service.createProductType("A".repeat(51), "desc", RiskProfile.Conservative, true)).rejects.toThrow("Product type name must be less than 50 characters");
    });

    it("throws error if description is too long", async () => {
      await expect(service.createProductType("name", "B".repeat(1001), RiskProfile.Conservative, true)).rejects.toThrow("Product type name must be less than 50 characters");
    });

    it("throws error if name already exists", async () => {
      productTypeRepo.findByNameForDuplicates.mockResolvedValue({ id: "existing" });
      await expect(service.createProductType("duplicate", "desc", RiskProfile.Conservative, true)).rejects.toThrow("Product type name already exists.");
    });

    it("throws error if no risk profile", async () => {
      productTypeRepo.findByNameForDuplicates.mockResolvedValue(null);
      await expect(service.createProductType("name", "desc", null as any, true)).rejects.toThrow("Risk profile is required.");
    });

    it("creates successfully", async () => {
      productTypeRepo.findByNameForDuplicates.mockResolvedValue(null);
      productTypeRepo.create.mockResolvedValue({ id: "new" });
      const result = await service.createProductType("name", "desc", RiskProfile.Conservative, true);
      expect(result).toEqual({ id: "new" });
      expect(productTypeRepo.create).toHaveBeenCalledWith({ name: "name", description: "desc", riskProfile: RiskProfile.Conservative, isActive: true });
    });
  });

  describe("updateProductTypeById", () => {
    it("throws error if not found", async () => {
      productTypeRepo.findById.mockResolvedValue(null);
      await expect(service.updateProductTypeById("1")).rejects.toThrow("Product type not found.");
    });

    it("updates fields and saves", async () => {
      const existing = { id: "1", name: "old", description: "old", riskProfile: RiskProfile.Conservative, isActive: true };
      productTypeRepo.findById.mockResolvedValue(existing);
      productTypeRepo.save.mockResolvedValue({ ...existing, name: "new" });
      
      await service.updateProductTypeById("1", "new", undefined, RiskProfile.Aggressive, false);
      
      expect(existing.name).toBe("new");
      expect(existing.riskProfile).toBe(RiskProfile.Aggressive);
      expect(existing.isActive).toBe(false);
      expect(productTypeRepo.save).toHaveBeenCalledWith(existing);
    });
  });

  describe("deactivateProductTypeById", () => {
    it("throws error if not found", async () => {
      productTypeRepo.findById.mockResolvedValue(null);
      await expect(service.deactivateProductTypeById("1")).rejects.toThrow("Product type not found.");
    });

    it("sets isActive to false and saves", async () => {
      const existing = { id: "1", isActive: true };
      productTypeRepo.findById.mockResolvedValue(existing);
      productTypeRepo.save.mockResolvedValue({ ...existing, isActive: false });

      await service.deactivateProductTypeById("1");

      expect(existing.isActive).toBe(false);
      expect(productTypeRepo.save).toHaveBeenCalledWith(existing);
    });
  });
});
