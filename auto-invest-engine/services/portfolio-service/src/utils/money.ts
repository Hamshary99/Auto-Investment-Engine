import Decimal from "decimal.js";

// Match the precision of the numeric(18, N) columns.
const CASH_DP = 2;
const SHARES_DP = 6;

// ROUND_HALF_EVEN ("banker's rounding") avoids the upward bias of HALF_UP over many transactions.
Decimal.set({ rounding: Decimal.ROUND_HALF_EVEN });

type Num = Decimal.Value;

export const d = (v: Num): Decimal => new Decimal(v);

export const cash = (v: Num): string => d(v).toFixed(CASH_DP);
export const shares = (v: Num): string => d(v).toFixed(SHARES_DP);

export const addCash = (a: Num, b: Num): string => d(a).plus(b).toFixed(CASH_DP);
export const subCash = (a: Num, b: Num): string => d(a).minus(b).toFixed(CASH_DP);

export const addShares = (a: Num, b: Num): string => d(a).plus(b).toFixed(SHARES_DP);

// cost = qty * price, rounded to cash precision.
export const cost = (qty: Num, price: Num): string => d(qty).times(price).toFixed(CASH_DP);

// Weighted-average cost basis: (oldQty * oldCost + addQty * addPrice) / (oldQty + addQty).
// Returns a string at SHARES_DP precision. Caller must ensure denom > 0.
export const weightedAvgCost = (
  oldQty: Num,
  oldCost: Num,
  addQty: Num,
  addPrice: Num
): string => {
  const numerator = d(oldQty).times(oldCost).plus(d(addQty).times(addPrice));
  const denom = d(oldQty).plus(addQty);
  return numerator.div(denom).toFixed(SHARES_DP);
};
