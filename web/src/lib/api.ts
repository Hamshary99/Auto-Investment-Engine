const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, body?.error || res.statusText, body?.code);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};

export interface AuthResponse {
  token: string;
  user?: { id: string; email: string };
}

export interface Me {
  id: string;
  email: string;
}

export interface Holding {
  symbol: string;
  quantity: number;
  averageCost?: number;
  marketValue?: number;
}

export interface Portfolio {
  id?: string;
  userId?: string;
  holdings: Holding[];
  cash?: number;
}

export interface Nav {
  total: number;
  asOf?: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  status?: string;
  createdAt?: string;
}
