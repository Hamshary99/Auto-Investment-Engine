import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate";
import { buildFundController } from "../controllers/index";
import { InvestFundDto } from "../dto/invest-fund.dto";
import { FundService } from "../services/index";

export const buildFundRouter = (fundService: FundService) => {
    const router = Router();
    const fc = buildFundController(fundService);

    router.get("/funds", requireAuth, fc.listFunds);
    router.get("/funds/:id", requireAuth, fc.getFund);
    router.post("/funds/:id/invest", requireAuth, validate(InvestFundDto), fc.investInFund);

    return router;
}