import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "") + "/api";

let memToken: string | null = null;

export async function setToken(token: string | null) {
  memToken = token;
  if (token) await storage.secureSet("dn_token", token);
  else await storage.secureRemove("dn_token");
}

export async function getToken(): Promise<string | null> {
  if (memToken) return memToken;
  memToken = await storage.secureGet("dn_token", null as any);
  return memToken;
}

async function request(path: string, opts: { method?: string; body?: any; auth?: boolean } = {}) {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const t = await getToken();
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data;
}

export const api = {
  get: (p: string, auth = true) => request(p, { auth }),
  post: (p: string, body?: any, auth = true) => request(p, { method: "POST", body, auth }),
  put: (p: string, body?: any, auth = true) => request(p, { method: "PUT", body, auth }),
  del: (p: string, auth = true) => request(p, { method: "DELETE", auth }),
};
