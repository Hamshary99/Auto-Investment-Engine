const PRICES: Record<string, number> = {
  AAPL: 180, GOOGL: 140, MSFT: 400, AMZN: 185, TSLA: 250,
  NVDA: 800, META: 480, NFLX: 600, AMD: 160, BABA: 80,
  V: 280, JPM: 195, WMT: 165, DIS: 110, PYPL: 65,
  SQ: 70, UBER: 75, SPOT: 300, SNAP: 12, COIN: 220,
};

export function getStubPrice(symbol: string): number {
  const p = PRICES[symbol.toUpperCase()];
  if (p == null) throw new Error(`no stub price for symbol ${symbol}`);
  return p;
}
