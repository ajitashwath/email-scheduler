"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { api, API_BASE_URL } from "./api";
import { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  loginWithGoogleUrl: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const { data } = await api.get<{ user: User }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount to hydrate session state
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        logout,
        loginWithGoogleUrl: `${API_BASE_URL}/api/auth/google`,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
