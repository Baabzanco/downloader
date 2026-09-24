import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AdminUserPublic } from '../types';

interface AdminAuthContextType {
  adminUser: AdminUserPublic | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasPermission: (permissionKey: string) => boolean;
  hasRole: (roleName: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auth/me', {
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setAdminUser(data.user);
          return;
        }
      }
      setAdminUser(null);
    } catch {
      setAdminUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'same-origin',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAdminUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error?.message || 'Authentication failed.' };
    } catch {
      return { success: false, error: 'Network communication failure.' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } finally {
      setAdminUser(null);
    }
  };

  const hasPermission = (permissionKey: string): boolean => {
    if (!adminUser) return false;
    // SUPER_ADMIN has full permissions
    if (adminUser.roles.some((r) => r.name === 'SUPER_ADMIN')) {
      return true;
    }
    return adminUser.permissions.includes(permissionKey);
  };

  const hasRole = (roleName: string): boolean => {
    if (!adminUser) return false;
    if (adminUser.roles.some((r) => r.name === 'SUPER_ADMIN')) {
      return true;
    }
    return adminUser.roles.some((r) => r.name === roleName);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        loading,
        login,
        logout,
        hasPermission,
        hasRole,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
