"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import authService, { LoginCredentials, Employee } from '@/services/authService';

interface AuthContextType {
  user: Employee | null;
  permissions: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<Employee | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Check if user is authenticated on mount and initialize token refresh
  useEffect(() => {
    checkAuth();
    // Initialize token refresh timer if user has valid session
    authService.initializeTokenRefresh();
  }, []);

  // Monitor token validity and redirect if expired
  useEffect(() => {
    // Public frontend routes that don't need authentication
    const publicRoutes = ['/login', '/forgot-password', '/e-commerce', '/catalog'];
    
    // Check if current path is public (exact match or starts with route/)
    const isPublicRoute = publicRoutes.some(route => 
      pathname === route || pathname?.startsWith(route + '/')
    );
    
    // Home page is also public
    const isHomePage = pathname === '/';
    
    // Skip auth checks for public routes, home page, or during initial load
    if (isPublicRoute || isHomePage || isLoading) {
      return;
    }

    // Check token validity periodically (every 30 seconds) for protected routes
    const interval = setInterval(() => {
      if (!authService.isAuthenticated() && user) {
        console.log('⏰ Token expired, logging out');
        logout();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [pathname, user, isLoading]);

  const checkAuth = async () => {
    try {
      if (authService.isAuthenticated()) {
        const employee = await authService.getCurrentUser();
        setUser(employee);
        authService.setUserData(employee);

        const perms = employee?.role?.permissions?.map((p) => p.slug) || [];
        setPermissions(perms);
      } else {
        // Token is expired or invalid
        authService.clearAuth();
        setUser(null);
        setPermissions([]);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      authService.clearAuth();
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials) => {
    try {
      // Login handles token storage and auto-refresh setup
      await authService.login(credentials);
      const employee = await authService.getCurrentUser();
      setUser(employee);
      const perms = employee?.role?.permissions?.map((p) => p.slug) || [];
      setPermissions(perms);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setPermissions([]);
      authService.clearAuth();
      router.push('/login');
    }
  };

  const refreshUser = async () => {
    try {
      const employee = await authService.getCurrentUser();
      setUser(employee);
      authService.setUserData(employee);
      const perms = employee?.role?.permissions?.map((p) => p.slug) || [];
      setPermissions(perms);
    } catch (error) {
      console.error('Refresh user error:', error);
      throw error;
    }
  };

  const roleSlug = user?.role?.slug;
  const isSuperAdmin = !!roleSlug && ['super-admin', 'super_admin', 'superadmin'].includes(roleSlug);

  const hasPermission = (permission: string) => {
    if (isSuperAdmin) return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]) => {
    if (isSuperAdmin) return true;
    return perms.every((p) => permissions.includes(p));
  };

  const value: AuthContextType = {
    user,
    permissions,
    isLoading,
    isAuthenticated: !!user,
    isSuperAdmin,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}