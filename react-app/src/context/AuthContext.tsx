import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AuthAPI, type SPConfig } from '../api/salesforce';

export interface PortalUser {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  username: string;
  role: 'User' | 'Portal Admin' | 'Super Admin';
  accountId?: string;
  accountName?: string;
  lastLogin?: string;
}

interface AuthContextType {
  user: PortalUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (firstName: string, lastName: string, email: string, password: string, company: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from server-rendered config
  useEffect(() => {
    const config: SPConfig | undefined = window.SP_CONFIG;
    if (config && config.sessionActive === 'true' && config.userId) {
      setUser({
        id: config.userId,
        firstName: '',
        lastName: '',
        name: config.userName,
        email: '',
        username: '',
        role: (config.userRole || 'User') as PortalUser['role'],
      });
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await AuthAPI.login(email, password);
      if (result.success && result.data) {
        const userData = result.data as Record<string, string>;
        // Set session cookie via JS (VF setCookies doesn't work reliably in RemoteAction on Sites)
        // VF getCookies() expects the apex__ prefix for cookies set via setCookies()
        if (userData.sessionToken) {
          document.cookie = `apex__SP_Session=${userData.sessionToken}; path=/`;
        }
        setUser({
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: (userData.role || 'User') as PortalUser['role'],
          accountId: userData.accountId,
          accountName: userData.accountName,
          lastLogin: userData.lastLogin,
        });
        return { success: true };
      }
      return { success: false, error: result.error || 'Login failed.' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []);

  const register = useCallback(async (
    firstName: string, lastName: string, email: string, password: string, company: string
  ) => {
    try {
      const result = await AuthAPI.register(firstName, lastName, email, password, company);
      if (result.success && result.data) {
        const userData = result.data as Record<string, string>;
        if (userData.sessionToken) {
          document.cookie = `apex__SP_Session=${userData.sessionToken}; path=/`;
        }
        setUser({
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: (userData.role || 'User') as PortalUser['role'],
          accountId: userData.accountId,
          accountName: userData.accountName,
        });
        return { success: true };
      }
      return { success: false, error: result.error || 'Registration failed.' };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthAPI.logout();
    } catch {
      // Best effort
    }
    document.cookie = 'apex__SP_Session=; path=/; max-age=0';
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const result = await AuthAPI.getCurrentUser();
      if (result.success && result.data) {
        const userData = result.data as Record<string, string>;
        setUser({
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          name: userData.name,
          email: userData.email,
          username: userData.username,
          role: (userData.role || 'User') as PortalUser['role'],
          accountId: userData.accountId,
          accountName: userData.accountName,
          lastLogin: userData.lastLogin,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }, []);

  const isAdmin = user?.role === 'Portal Admin' || user?.role === 'Super Admin';
  const isSuperAdmin = user?.role === 'Super Admin';

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: user !== null,
      isAdmin,
      isSuperAdmin,
      loading,
      login,
      register,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
