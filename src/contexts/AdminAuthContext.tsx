"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AdminUser, AdminRole } from "@/types/admin";
import { adminLogout, fetchAdminMe } from "@/services/adminApi";
import { useRouter } from "next/navigation";

interface AdminAuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  isOwner: boolean;
  isAdminOrOwner: boolean;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AdminUser | null) => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await fetchAdminMe();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await adminLogout();
    setUser(null);
    router.push("/admin/login");
  }, [router]);

  const isOwner = user?.role === "owner";
  const isAdminOrOwner = user?.role === "owner" || user?.role === "admin";

  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    if (user.role === "owner" || user.role === "admin") return true;
    if (Array.isArray(user.permissions) && user.permissions.includes(permission)) return true;
    return false;
  }, [user]);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        loading,
        isOwner,
        isAdminOrOwner,
        hasPermission,
        refreshUser,
        logout,
        setUser,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}
