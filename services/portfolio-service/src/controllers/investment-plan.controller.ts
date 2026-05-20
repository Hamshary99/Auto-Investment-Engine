import { NextFunction, Response } from "express";
import { AuthedRequest } from "../middleware/auth.middleware";
import { InvestmentPlanService } from "../services/index";
import { RiskProfile } from "../models/types";
import { ApiError } from "../utils/error.handler";

const isRiskProfile = (v: unknown): v is RiskProfile =>
  typeof v === "string" && (Object.values(RiskProfile) as string[]).includes(v);

export const buildInvestmentPlanController = (service: InvestmentPlanService) => ({
  listPlans: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const plans = await service.listPlansByUserId(req.userId!);
      res.json(plans);
    } catch (e) {
      next(e);
    }
  },

  getPlan: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const plan = await service.getPlanById(String(req.params.id), req.userId!);
      res.json(plan);
    } catch (e) {
      next(e);
    }
  },

  createFromQuiz: async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      const { riskProfile, reservePct, autoInvest } = req.body ?? {};
      if (!isRiskProfile(riskProfile)) {
        throw new ApiError("Invalid or missing riskProfile", 400, "invalid_input");
      }
      const plan = await service.createPlanFromRiskProfile({
        userId: req.userId!,
        riskProfile,
        reservePct,
        autoInvest,
      });
      res.status(201).json(plan);
    } catch (e) {
      next(e);
    }
  },
});
