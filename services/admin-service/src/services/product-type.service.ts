import { ProductTypeRepository, AssociatedIndexFundRepository, ProductType, AssociatedIndexFund, RiskProfile } from "@auto-invest/shared";
import { EntityManager } from "typeorm";

export class ProductTypeService {
  constructor(private readonly productTypeRepo: ProductTypeRepository, private readonly associatedIndexFundRepo: AssociatedIndexFundRepository) { }

  async getProductTypeById(id: string, tx?: EntityManager): Promise<ProductType | null> {
    return this.productTypeRepo.findById(id, tx as any);
  }

  async getAll(tx?: EntityManager): Promise<ProductType[]> {
    return this.productTypeRepo.findAll();
  }

  async getAllActive(tx?: EntityManager): Promise<ProductType[]> {
    return this.productTypeRepo.findByActive();
  }

  async createProductType(
    name: string,
    description: string,
    riskProfile: RiskProfile,
    isActive = true
  ) {
    if(name.length > 50 || description.length > 1000) {
      throw new Error("Product type name must be less than 50 characters and description must be less than 1000 characters.")
    }

    const existing = await this.productTypeRepo.findByNameForDuplicates(name);
    if(existing) throw new Error("Product type name already exists.");

    if(!riskProfile) throw new Error("Risk profile is required.");

    return this.productTypeRepo.create({ name, description, riskProfile, isActive });

  }

  async updateProductTypeById(
    id: string,
    name?: string,
    description?: string,
    riskProfile?: RiskProfile,
    isActive?: boolean,
    tx?: EntityManager
  ) {
    const pt = await this.productTypeRepo.findById(id, tx as any);
    if(!pt) throw new Error("Product type not found.");

    if(name) pt.name = name;
    if(description) pt.description = description;
    if(riskProfile) pt.riskProfile = riskProfile;
    if(isActive !== undefined) pt.isActive = isActive;

    return await this.productTypeRepo.save(pt);
  }

  async deactivateProductTypeById(id: string, tx?: EntityManager): Promise<ProductType | null> {
    const pt = await this.productTypeRepo.findById(id, tx as any);
    if(!pt) throw new Error("Product type not found.");

    pt.isActive = false;

    return await this.productTypeRepo.save(pt);
  }

  
}
