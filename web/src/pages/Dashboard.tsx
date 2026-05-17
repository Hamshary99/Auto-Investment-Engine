import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Nav, Portfolio } from "../lib/api";

function formatMoney(n: number | undefined) {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function Dashboard() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [nav, setNav] = useState<Nav | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get<Portfolio>("/api/user-portfolio"), api.get<Nav>("/api/nav")])
      .then(([p, n]) => {
        setPortfolio(p);
        setNav(n);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const holdings = portfolio?.holdings ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Portfolio</h1>
          <p className="text-sm text-slate-400">Your current positions and total net asset value.</p>
        </div>
        <Link to="/trade" className="btn-primary self-start sm:self-auto">
          + New order
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Net asset value" value={formatMoney(nav?.total)} accent />
        <Stat label="Holdings" value={String(holdings.length)} />
        <Stat label="Cash" value={formatMoney(portfolio?.cash)} />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 className="font-medium">Holdings</h2>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
        </div>
        {err ? (
          <div className="px-6 py-10 text-center text-sm text-red-300">{err}</div>
        ) : holdings.length === 0 && !loading ? (
          <div className="px-6 py-16 text-center">
            <p className="text-slate-400">No positions yet.</p>
            <Link to="/trade" className="btn-primary mt-4 inline-flex">
              Place your first order
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">Symbol</th>
                <th className="px-6 py-3 font-medium">Quantity</th>
                <th className="px-6 py-3 font-medium">Avg. cost</th>
                <th className="px-6 py-3 font-medium text-right">Market value</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.symbol} className="border-t border-slate-800/60">
                  <td className="px-6 py-4 font-medium">{h.symbol}</td>
                  <td className="px-6 py-4 text-slate-300">{h.quantity}</td>
                  <td className="px-6 py-4 text-slate-300">{formatMoney(h.averageCost)}</td>
                  <td className="px-6 py-4 text-right text-slate-100">
                    {formatMoney(h.marketValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accent ? "text-brand" : "text-slate-100"}`}>
        {value}
      </div>
    </div>
  );
}
