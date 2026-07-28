"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  fullName: string | null;
  role: string | null;
  pageAccess: string[];
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pageAccess, setPageAccess] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedFullName = localStorage.getItem("fullName");
        const storedRole = localStorage.getItem("role");
        const storedAuth = localStorage.getItem("isAuthenticated");
        const storedAccess = localStorage.getItem("pageAccess");

        if (storedAuth === "true" && storedUser) {
          setIsAuthenticated(true);
          setUser(storedUser);
          setFullName(storedFullName);
          setRole(storedRole);
          if (storedAccess) {
            setPageAccess(JSON.parse(storedAccess));
          }

          const isHardcoded = storedUser === "user" || storedUser === "admin";
          if (!isHardcoded) {
            try {
              const { data: foundUser } = await supabase
                .from("users_master")
                .select("full_name, role, page_access")
                .eq("username", storedUser.trim())
                .single();

              if (foundUser) {
                const newAccessList = foundUser.page_access
                  ? String(foundUser.page_access).split(",").map((p: string) => p.trim()).filter(Boolean)
                  : [];

                setFullName(foundUser.full_name || storedUser);
                setRole(foundUser.role || "User");
                setPageAccess(newAccessList);

                localStorage.setItem("fullName", foundUser.full_name || storedUser);
                localStorage.setItem("role", foundUser.role || "User");
                localStorage.setItem("pageAccess", JSON.stringify(newAccessList));
              }
            } catch (fetchErr) {
              console.error("Background sync failed", fetchErr);
            }
          }
        }
      } catch (e) {
        console.error("Auth initialization error", e);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const u = username.trim().toLowerCase();
      const p = password.trim();

      // Hardcoded credentials (fallback)
      if (u === "admin" && p === "admin123") {
        const matchedUser = {
          username: "admin",
          fullName: "Admin",
          role: "Admin",
          pageAccess: []
        };
        setIsAuthenticated(true);
        setUser(matchedUser.username);
        setFullName(matchedUser.fullName);
        setRole(matchedUser.role);
        setPageAccess(matchedUser.pageAccess);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", matchedUser.username);
        localStorage.setItem("fullName", matchedUser.fullName);
        localStorage.setItem("role", matchedUser.role);
        localStorage.setItem("pageAccess", JSON.stringify(matchedUser.pageAccess));
        router.push("/");
        return true;
      }

      if (u === "user" && p === "user123") {
        const matchedUser = {
          username: "user",
          fullName: "User",
          role: "User",
          pageAccess: []
        };
        setIsAuthenticated(true);
        setUser(matchedUser.username);
        setFullName(matchedUser.fullName);
        setRole(matchedUser.role);
        setPageAccess(matchedUser.pageAccess);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", matchedUser.username);
        localStorage.setItem("fullName", matchedUser.fullName);
        localStorage.setItem("role", matchedUser.role);
        localStorage.setItem("pageAccess", JSON.stringify(matchedUser.pageAccess));
        router.push("/");
        return true;
      }

      // Query Supabase users_master table
      const { data: foundUser, error } = await supabase
        .from("users_master")
        .select("username, full_name, password_hash, role, page_access")
        .eq("username", username.trim())
        .single();

      if (error || !foundUser) {
        return false;
      }

      // Verify password (plain text match — matches existing Google Sheets behavior)
      if (String(foundUser.password_hash).trim() !== password.trim()) {
        return false;
      }

      const accessList = foundUser.page_access
        ? String(foundUser.page_access).split(",").map((p: string) => p.trim()).filter(Boolean)
        : [];

      setIsAuthenticated(true);
      setUser(username);
      setFullName(foundUser.full_name || username);
      setRole(foundUser.role || "User");
      setPageAccess(accessList);

      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("user", username);
      localStorage.setItem("fullName", foundUser.full_name || username);
      localStorage.setItem("role", foundUser.role || "User");
      localStorage.setItem("pageAccess", JSON.stringify(accessList));

      router.push("/");
      return true;
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setFullName(null);
    setRole(null);
    setPageAccess([]);

    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("user");
    localStorage.removeItem("fullName");
    localStorage.removeItem("role");
    localStorage.removeItem("pageAccess");

    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, fullName, role, pageAccess, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
