import { Router } from "express";
import { MarketDataService } from "../services/market-data.service";

/**
 * GET /market-prices
 *
 * Returns the current in-memory price map for all tracked symbols.
 * Useful for Postman debugging and potential frontend price displays.
 *
 * Response shape:
 *   {
 *     "count": 8,
 *     "prices": [
 *       { "symbol": "AAPL", "price": 182.34, "basePrice": 180, "changePct": 1.30, "riskProfile": "aggressive", "lastUpdated": "..." },
 *       ...
 *     ]
 *   }
 */
export function buildMarketPricesRouter(marketData: MarketDataService): Router {
  const router = Router();

  router.get("/market-prices", (_req, res) => {
    const prices = marketData.getAllPrices();
    res.json({ count: prices.length, prices });
  });

  return router;
}
