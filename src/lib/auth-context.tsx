import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CodeUser {
  accessCode: string;
  linkId?: string;
  isAdmin: boolean;
}

interface AuthContextType {
  codeUser: CodeUser | null;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signInWithCode: (code: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CODE_USER_KEY = 'telegram_code_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [codeUser, setCodeUser] = useState<CodeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for code-based user in localStorage
    const storedCodeUser = localStorage.getItem(CODE_USER_KEY);
    if (storedCodeUser) {
      try {
        setCodeUser(JSON.parse(storedCodeUser));
      } catch {
        localStorage.removeItem(CODE_USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signInWithCode = async (code: string) => {
    try {
      const trimmedCode = code.trim().toUpperCase();

      // First check if it's the admin code
      const { data: adminSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'admin_code')
        .maybeSingle();

      if (adminSetting?.value === trimmedCode) {
        const codeUserData: CodeUser = {
          accessCode: trimmedCode,
          isAdmin: true,
        };
        localStorage.setItem(CODE_USER_KEY, JSON.stringify(codeUserData));
        setCodeUser(codeUserData);
        return { error: null };
      }

      // Check if it's a user invite link code
      const { data: linkData, error } = await supabase
        .from('invite_links')
        .select('id, access_code')
        .eq('access_code', trimmedCode)
        .maybeSingle();

      if (error) {
        return { error: new Error('Failed to verify code') };
      }

      if (!linkData) {
        return { error: new Error('Invalid access code') };
      }

      const codeUserData: CodeUser = {
        accessCode: linkData.access_code!,
        linkId: linkData.id,
        isAdmin: false,
      };
      
      localStorage.setItem(CODE_USER_KEY, JSON.stringify(codeUserData));
      setCodeUser(codeUserData);

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    localStorage.removeItem(CODE_USER_KEY);
    setCodeUser(null);
  };

  const isAdmin = codeUser?.isAdmin ?? false;
  const isAuthenticated = !!codeUser;

  return (
    <AuthContext.Provider value={{ 
      codeUser,
      loading, 
      isAdmin,
      isAuthenticated,
      signInWithCode,
      signOut 
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
