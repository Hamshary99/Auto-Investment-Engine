import { ProductTypeRepository, AssociatedIndexFundRepository, RiskProfile } from "@auto-invest/shared";
import { logger } from "../utils/logger";

/* ──────────────────────────────────────────────────────────────────────────
 * Base prices used to seed the in-memory cache at startup.
 * These are the same values that were in the old price.stub.ts.
 * In production, this would come from a market data API (e.g. Alpaca, IEX).
 * ──────────────────────────────────────────────────────────────────────── */
const BASE_PRICES: Record<string, number> = {
  AAPL: 180, GOOGL: 140, MSFT: 400, AMZN: 185, TSLA: 250,
  NVDA: 800, META: 480, NFLX: 600, AMD: 160, BABA: 80,
  V: 280, JPM: 195, WMT: 165, DIS: 110, PYPL: 65,
  SQ: 70, UBER: 75, SPOT: 300, SNAP: 12, COIN: 220,
  // ETFs from the seed
  BND: 72, VTI: 260, AGG: 100, QQQ: 460, ARKK: 45,
};

/**
 * Per-tick maximum percentage change by risk profile.
 * Conservative symbols barely budge; aggressive symbols swing hard.
 *
 * The actual change is sampled uniformly in [-max, +max], so the
 * range for aggressive is ±10% per tick — up to 10% up OR 10% down.
 */
const VOLATILITY_BY_RISK: Record<RiskProfile, number> = {
  [RiskProfile.Conservative]: 0.02,   // ±2%
  [RiskProfile.Moderate]:     0.05,   // ±5%
  [RiskProfile.Aggressive]:   0.10,   // ±10%
};

/** Minimum price floor — a symbol can never go below $0.01. */
const PRICE_FLOOR = 0.01;

/* ──────────────────────────────────────────────────────────────────────── */

export interface MarketEntry {
  symbol: string;
  price: number;
  basePrice: number;         // original seed price — used for % change display
  riskProfile: RiskProfile;
  lastUpdated: Date;
}

export interface MarketTickResult {
  symbolCount: number;
  biggestGainer: { symbol: string; changePct: number } | null;
  biggestLoser:  { symbol: string; changePct: number } | null;
  tickTimestamp: Date;
}

export interface MarketPriceSnapshot {
  symbol: string;
  price: number;
  basePrice: number;
  changePct: number;         // % change from base price
  riskProfile: RiskProfile;
  lastUpdated: string;       // ISO timestamp
}

/**
 * Centralized in-memory market price service.
 *
 * Lifecycle:
 *   1. On startup, `initialize()` reads the product catalog from DB,
 *      discovers all unique symbols, maps each to a risk profile,
 *      and seeds prices from BASE_PRICES.
 *   2. On every `market.tick.requested` event, `applyMarketTick()`
 *      jitters each price using a uniform random walk scaled by
 *      the symbol's associated risk profile.
 *   3. All order execution and allocation logic calls `getPrice(symbol)`
 *      instead of the old hardcoded stub.
 *
 * In production this would be replaced by a real market data feed
 * (WebSocket from Alpaca, IEX, etc.) — the interface stays the same.
 */
export class MarketDataService {
  private readonly prices = new Map<string, MarketEntry>();
  private initialized = false;
  private tickCount = 0;

  constructor(
    private readonly productTypes: ProductTypeRepository,
    private readonly associatedIndexFunds: AssociatedIndexFundRepository,
  ) {}

  /* ── Startup ─────────────────────────────────────────────────────── */

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load all active product types with their fund mixes
    const products = await this.productTypes.findByActive();

    // Build a map of symbol → highest risk profile
    // (a symbol in both conservative and aggressive → aggressive wins)
    const symbolRisk = new Map<string, RiskProfile>();
    const riskOrder: Record<RiskProfile, number> = {
      [RiskProfile.Conservative]: 0,
      [RiskProfile.Moderate]: 1,
      [RiskProfile.Aggressive]: 2,
    };

    for (const product of products) {
      const funds = product.associatedIndexFunds || [];
      for (const fund of funds) {
        const existing = symbolRisk.get(fund.symbol);
        if (!existing || riskOrder[product.riskProfile] > riskOrder[existing]) {
          symbolRisk.set(fund.symbol, product.riskProfile);
        }
      }
    }

    // Seed prices
    const now = new Date();
    for (const [symbol, riskProfile] of symbolRisk.entries()) {
      const basePrice = BASE_PRICES[symbol.toUpperCase()] ?? 100;
      this.prices.set(symbol.toUpperCase(), {
        symbol: symbol.toUpperCase(),
        price: basePrice,
        basePrice,
        riskProfile,
        lastUpdated: now,
      });
    }

    this.initialized = true;
    logger.info(
      { symbolCount: this.prices.size, symbols: [...this.prices.keys()] },
      "market data service initialized with catalog symbols",
    );
  }

  /* ── Price Lookups ───────────────────────────────────────────────── */

  /**
   * Get the current market price for a symbol.
   * Falls back to BASE_PRICES or $100 if symbol is unknown —
   * same safety net as the old getStubPrice.
   */
  getPrice(symbol: string): number {
    const upper = symbol.toUpperCase();
    const entry = this.prices.get(upper);
    if (entry) return entry.price;

    // Unknown symbol — seed it lazily with moderate volatility
    const basePrice = BASE_PRICES[upper] ?? 100;
    this.prices.set(upper, {
      symbol: upper,
      price: basePrice,
      basePrice,
      riskProfile: RiskProfile.Moderate,
      lastUpdated: new Date(),
    });
    logger.warn({ symbol: upper, price: basePrice }, "symbol not in catalog, seeded lazily");
    return basePrice;
  }

  /**
   * Return all tracked prices as a snapshot array for the REST endpoint.
   */
  getAllPrices(): MarketPriceSnapshot[] {
    const result: MarketPriceSnapshot[] = [];
    for (const entry of this.prices.values()) {
      const changePct = entry.basePrice > 0
        ? ((entry.price - entry.basePrice) / entry.basePrice) * 100
        : 0;
      result.push({
        symbol: entry.symbol,
        price: parseFloat(entry.price.toFixed(2)),
        basePrice: entry.basePrice,
        changePct: parseFloat(changePct.toFixed(2)),
        riskProfile: entry.riskProfile,
        lastUpdated: entry.lastUpdated.toISOString(),
      });
    }
    // Sort by symbol for stable output
    return result.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  /* ── Market Tick (Random Walk) ───────────────────────────────────── */

  /**
   * Apply one tick of random price movement to every tracked symbol.
   * Called by the market-tick consumer on each scheduler event.
   *
   * Each symbol's price is jittered by a uniform random percentage
   * in [-maxDelta, +maxDelta] where maxDelta is determined by the
   * symbol's risk profile:
   *   - Conservative: ±2%
   *   - Moderate:     ±5%
   *   - Aggressive:   ±10%
   */
  applyMarketTick(): MarketTickResult {
    const now = new Date();
    
    // In production, prices should be updated via real API feeds, not random walks.
    if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "dev") {
      logger.info("Market tick simulator skipped (production mode expects real API feeds)");
      return { symbolCount: this.prices.size, biggestGainer: null, biggestLoser: null, tickTimestamp: now };
    }

    this.tickCount++;

    let biggestGainer: { symbol: string; changePct: number } | null = null;
    let biggestLoser:  { symbol: string; changePct: number } | null = null;

    for (const entry of this.prices.values()) {
      const maxDelta = VOLATILITY_BY_RISK[entry.riskProfile];
      // Uniform random in [-maxDelta, +maxDelta]
      const changePct = (Math.random() * 2 - 1) * maxDelta;
      const oldPrice = entry.price;
      let newPrice = oldPrice * (1 + changePct);

      // Enforce price floor
      newPrice = Math.max(newPrice, PRICE_FLOOR);
      // Round to 2 decimal places
      newPrice = parseFloat(newPrice.toFixed(2));

      entry.price = newPrice;
      entry.lastUpdated = now;

      // Track biggest movers
      const tickChangePct = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;

      if (!biggestGainer || tickChangePct > biggestGainer.changePct) {
        biggestGainer = { symbol: entry.symbol, changePct: parseFloat(tickChangePct.toFixed(2)) };
      }
      if (!biggestLoser || tickChangePct < biggestLoser.changePct) {
        biggestLoser = { symbol: entry.symbol, changePct: parseFloat(tickChangePct.toFixed(2)) };
      }
    }

    const result: MarketTickResult = {
      symbolCount: this.prices.size,
      biggestGainer,
      biggestLoser,
      tickTimestamp: now,
    };

    logger.info(
      {
        tick: this.tickCount,
        symbols: result.symbolCount,
        gainer: result.biggestGainer,
        loser: result.biggestLoser,
      },
      "market tick applied",
    );

    return result;
  }
}
