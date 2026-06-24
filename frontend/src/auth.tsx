import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { router } from "expo-router";
import { api, setToken, getToken } from "@/src/api";
import { storage } from "@/src/utils/storage";

export type User = {
  id: string;
  role: "customer" | "agent" | "admin" | "manager";
  name: string;
  phone: string;
  email?: string;
  addresses?: any[];
  default_address_id?: string;
  referral_code?: string;
  employee_id?: string;
  permissions?: Record<string, boolean>;
  suspended?: boolean;
  preferences?: any;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

const PUSH_TOKEN_KEY = "dn_push_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const signingOutRef = useRef(false);

  const bootstrap = useCallback(async () => {
    try {
      const t = await getToken();
      if (t) {
        const me = await api.get("/auth/me");
        setUser(me);
      }
    } catch {
      await setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const signIn = async (token: string, u: User) => {
    await setToken(token);
    setUser(u);
  };

  const signOut = async () => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    try {
      // Unregister push token from backend BEFORE clearing JWT
      try {
        const pushToken = await storage.getItem<string | null>(PUSH_TOKEN_KEY, null);
        if (pushToken) {
          await api.post("/push/unregister", { token: pushToken });
        }
      } catch { /* non-fatal */ }
      await setToken(null);
      setUser(null);
      // Hard navigation to login -- prevents "stuck on protected screen" issue
      try { router.replace("/login" as any); } catch { /* router not ready */ }
    } finally {
      signingOutRef.current = false;
    }
  };

  const refresh = async () => {
    try {
      const me = await api.get("/auth/me");
      setUser(me);
    } catch {}
  };

  return <Ctx.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function homeRouteForRole(role?: string) {
  if (role === "agent") return "/(agent)/route";
  if (role === "admin") return "/(admin)/dashboard";
  if (role === "manager") return "/(manager)/dashboard";
  return "/(customer)/home";
}
