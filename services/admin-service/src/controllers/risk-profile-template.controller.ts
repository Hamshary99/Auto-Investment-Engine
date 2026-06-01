import { RiskProfileTemplateService } from "../services/risk-profile-template.service";

export class RiskProfileTemplateController {
  constructor(private riskProfileTemplateService: RiskProfileTemplateService) { }

  getTemplatesByProfile = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
  updateTemplatesByProfile = async (req: any, res: any, next: any) => { res.send("Not implemented"); };
}
