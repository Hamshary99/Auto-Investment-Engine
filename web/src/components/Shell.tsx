import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Shell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand to-emerald-700 grid place-items-center font-bold text-slate-950">
              A
            </div>
            <span className="font-semibold tracking-tight">AutoInvest</span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Portfolio
            </NavLink>
            <NavLink to="/trade" className={navClass}>
              Trade
            </NavLink>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-slate-400">{user?.email}</span>
            <button
              className="btn-ghost"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return [
    "px-3 py-1.5 rounded-md text-sm transition",
    isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-900",
  ].join(" ");
}
