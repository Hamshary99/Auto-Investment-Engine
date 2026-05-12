import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, AuthResponse, Me } from "./api";

interface AuthCtx {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<Me>("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  async function handleAuth(path: string, email: string, password: string) {
    const res = await api.post<AuthResponse>(path, { email, password });
    localStorage.setItem("token", res.token);
    const me = await api.get<Me>("/auth/me");
    setUser(me);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        login: (e, p) => handleAuth("/auth/login", e, p),
        register: (e, p) => handleAuth("/auth/register", e, p),
        logout: () => {
          localStorage.removeItem("token");
          setUser(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
