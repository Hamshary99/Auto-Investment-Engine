export class ProductTypeService {
  // Implement logic here
}

export class ProductTypeController {
  constructor(private productTypeService: ProductTypeService) {}

  createProductType = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
  updateProductType = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
  deactivateProductType = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
  updateAssociatedIndexFunds = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
}
