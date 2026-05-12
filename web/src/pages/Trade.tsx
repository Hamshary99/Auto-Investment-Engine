import { FormEvent, useState } from "react";
import { api, ApiError, Order } from "../lib/api";

export function Trade() {
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<Order | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const order = await api.post<Order>("/api/orders", {
        symbol: symbol.toUpperCase(),
        side,
        quantity: Number(quantity),
      });
      setLast(order);
      setSymbol("");
      setQuantity("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Place an order</h1>
        <p className="mt-1 text-sm text-slate-400">
          Submit a buy or sell. Orders are queued and processed asynchronously.
        </p>

        <form onSubmit={submit} className="card mt-8 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Symbol</label>
              <input
                className="input uppercase"
                placeholder="AAPL"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Quantity</label>
              <input
                className="input"
                type="number"
                step="any"
                min="0"
                placeholder="10"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Side</label>
            <div className="grid grid-cols-2 gap-2">
              <SideToggle active={side === "BUY"} tone="buy" onClick={() => setSide("BUY")}>
                Buy
              </SideToggle>
              <SideToggle active={side === "SELL"} tone="sell" onClick={() => setSide("SELL")}>
                Sell
              </SideToggle>
            </div>
          </div>

          {err && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}

          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? "Submitting…" : `Submit ${side.toLowerCase()} order`}
          </button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="card">
          <h2 className="font-medium">Last submitted</h2>
          {last ? (
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Order ID" value={last.id} />
              <Row label="Symbol" value={last.symbol} />
              <Row label="Side" value={last.side} />
              <Row label="Quantity" value={String(last.quantity)} />
              {last.status && <Row label="Status" value={last.status} />}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No orders submitted in this session.</p>
          )}
        </div>

        <div className="card text-sm text-slate-400">
          <h3 className="font-medium text-slate-200">How it works</h3>
          <p className="mt-2">
            Orders are accepted by the gateway, signed, and forwarded to the portfolio service,
            which publishes them to the event bus for asynchronous execution.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SideToggle({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "buy" | "sell";
  onClick: () => void;
  children: React.ReactNode;
}) {
  const activeCls =
    tone === "buy"
      ? "bg-emerald-500/15 border-emerald-500/60 text-emerald-300"
      : "bg-rose-500/15 border-rose-500/60 text-rose-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-4 py-2 text-sm font-medium transition",
        active ? activeCls : "border-slate-800 bg-slate-900/40 text-slate-400 hover:text-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 break-all text-right">{value}</dd>
    </div>
  );
}
