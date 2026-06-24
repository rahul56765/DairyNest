import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, getToken } from "@/src/api";

export type User = {
  id: string;
  role: "customer" | "agent" | "admin";
  name: string;
  phone: string;
  email?: string;
  addresses?: any[];
  default_address_id?: string;
  referral_code?: string;
  employee_id?: string;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    await setToken(null);
    setUser(null);
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
  return "/(customer)/home";
}
