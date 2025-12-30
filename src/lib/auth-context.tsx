import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CodeUser {
  accessCode: string;
  linkId?: string;
  adminId?: string;
  adminName?: string;
  resellerId?: string;
  resellerName?: string;
  credits?: number;
  groupId?: string;
  groupName?: string;
  isAdmin: boolean;
  isReseller: boolean;
}

interface AuthContextType {
  codeUser: CodeUser | null;
  loading: boolean;
  isAdmin: boolean;
  isReseller: boolean;
  isAuthenticated: boolean;
  isBanned: boolean;
  signInWithCode: (code: string) => Promise<{ error: Error | null; isBanned?: boolean }>;
  signOut: () => Promise<void>;
  clearBannedState: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CODE_USER_KEY = 'telegram_code_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [codeUser, setCodeUser] = useState<CodeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const storedCodeUser = localStorage.getItem(CODE_USER_KEY);
    if (storedCodeUser) {
      try {
        const parsed = JSON.parse(storedCodeUser);
        // Validate stored session server-side
        validateStoredSession(parsed);
      } catch {
        localStorage.removeItem(CODE_USER_KEY);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const validateStoredSession = async (stored: CodeUser) => {
    try {
      // Re-verify the code server-side to ensure it's still valid
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { code: stored.accessCode }
      });

      // Check for banned in error response
      if (error) {
        const errorContext = error.context;
        if (errorContext) {
          try {
            const errorBody = await errorContext.json();
            if (errorBody?.isBanned) {
              setIsBanned(true);
              localStorage.removeItem(CODE_USER_KEY);
              setCodeUser(null);
              setLoading(false);
              return;
            }
          } catch {
            // Ignore parse errors
          }
        }
        localStorage.removeItem(CODE_USER_KEY);
        setCodeUser(null);
        setLoading(false);
        return;
      }

      if (!data?.success) {
        // Check if user is banned
        if (data?.isBanned) {
          setIsBanned(true);
        }
        // Session is no longer valid
        localStorage.removeItem(CODE_USER_KEY);
        setCodeUser(null);
      } else {
        // Session is valid, update with server data
        const newCodeUser: CodeUser = data.data;
        localStorage.setItem(CODE_USER_KEY, JSON.stringify(newCodeUser));
        setCodeUser(newCodeUser);
        setIsBanned(false);
      }
    } catch {
      // On error, keep stored session but don't trust it fully
      localStorage.removeItem(CODE_USER_KEY);
      setCodeUser(null);
    }
    setLoading(false);
  };

  const refreshUser = async () => {
    if (!codeUser?.accessCode) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { code: codeUser.accessCode }
      });

      if (!error && data?.success) {
        const newCodeUser: CodeUser = data.data;
        localStorage.setItem(CODE_USER_KEY, JSON.stringify(newCodeUser));
        setCodeUser(newCodeUser);
      }
    } catch {
      // Ignore refresh errors
    }
  };

  const signInWithCode = async (code: string) => {
    try {
      // Validate code format client-side first
      const trimmedCode = code.trim().toUpperCase();
      
      if (trimmedCode.length < 6 || trimmedCode.length > 20) {
        return { error: new Error('Invalid code format') };
      }

      if (!/^[A-Z0-9]+$/.test(trimmedCode)) {
        return { error: new Error('Invalid code format') };
      }

      // Verify code server-side via Edge Function
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { code: trimmedCode }
      });

      // Handle both error object and data response for banned check
      if (error) {
        // Try to parse error context for banned status
        const errorContext = error.context;
        if (errorContext) {
          try {
            const errorBody = await errorContext.json();
            if (errorBody?.isBanned) {
              setIsBanned(true);
              return { error: new Error('This user is banned'), isBanned: true };
            }
          } catch {
            // Ignore parse errors
          }
        }
        return { error: new Error('Failed to verify code') };
      }

      if (!data?.success) {
        // Check if user is banned
        if (data?.isBanned) {
          setIsBanned(true);
          return { error: new Error('This user is banned'), isBanned: true };
        }
        return { error: new Error(data?.error || 'Invalid access code') };
      }

      const codeUserData: CodeUser = data.data;
      localStorage.setItem(CODE_USER_KEY, JSON.stringify(codeUserData));
      setCodeUser(codeUserData);
      setIsBanned(false);
      return { error: null };

    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(CODE_USER_KEY);
    setCodeUser(null);
    setIsBanned(false);
  };

  const clearBannedState = () => {
    setIsBanned(false);
  };

  const isAdmin = codeUser?.isAdmin ?? false;
  const isReseller = codeUser?.isReseller ?? false;
  const isAuthenticated = !!codeUser;

  return (
    <AuthContext.Provider value={{ 
      codeUser,
      loading, 
      isAdmin,
      isReseller,
      isAuthenticated,
      isBanned,
      signInWithCode,
      signOut,
      clearBannedState,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
