import { ProductTypeService } from "../services/product-type.service";

export class ProductTypeController {
  constructor(private productTypeService: ProductTypeService) { }

  async getAllProductTypes(req: any, res: any, next: any) {
    try {
      const productTypes = await this.productTypeService.getAll();
      res.json(productTypes);
    } catch (error) {
      next(error);
    }
  }

  async getActiveProductTypes(req: any, res: any, next: any) {
    try {
      const productTypes = await this.productTypeService.getAllActive();
      res.json(productTypes);
    } catch (error) {
      next(error);
    }
  }

  async getProductTypeById(req: any, res: any, next: any) {
    try {
      const productType = await this.productTypeService.getProductTypeById(req.params.id);
      res.json(productType);
    } catch (error) {
      next(error);
    }
  }

  async createProductType(req: any, res: any, next: any) {
    try {
      const productType = await this.productTypeService.createProductType(req.body.name, req.body.description, req.body.riskProfile, req.body.isActive);
      res.json(productType);
    } catch (error) {
      next(error);
    }
  }

  async updateProductType(req: any, res: any, next: any) {
    try {
      const productType = await this.productTypeService.updateProductTypeById(req.params.id, req.body.name, req.body.description, req.body.riskProfile, req.body.isActive);
      res.json(productType);
    } catch (error) {
      next(error);
    }
  }

  async deactivateProductType(req: any, res: any, next: any) {
    try {
      const productType = await this.productTypeService.deactivateProductTypeById(req.params.id);
      res.json(productType);
    } catch (error) {
      next(error);
    }
  }

  // TODO: implement
  // async updateAssociatedIndexFunds(req: any, res: any, next: any) {
  //   try {
  //     const productType = await this.productTypeService.updateAssociatedIndexFunds(req.params.id, req.body.associatedIndexFunds);
  //     res.json(productType);
  //   } catch (error) {
  //     next(error);
  //   }
  // }
}
