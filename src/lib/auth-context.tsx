import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CodeUser {
  accessCode: string;
  linkId?: string;
  adminId?: string;
  adminName?: string;
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

      // Check if it's an admin code
      const { data: adminData, error: adminError } = await supabase
        .from('admin_codes')
        .select('id, code, name, is_active')
        .eq('code', trimmedCode)
        .eq('is_active', true)
        .maybeSingle();

      if (adminData) {
        // Update last_used_at
        await supabase
          .from('admin_codes')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', adminData.id);

        const codeUserData: CodeUser = {
          accessCode: trimmedCode,
          adminId: adminData.id,
          adminName: adminData.name,
          isAdmin: true,
        };
        localStorage.setItem(CODE_USER_KEY, JSON.stringify(codeUserData));
        setCodeUser(codeUserData);
        return { error: null };
      }

      // Check if it's a user invite link code
      const { data: linkData, error: linkError } = await supabase
        .from('invite_links')
        .select('id, access_code')
        .eq('access_code', trimmedCode)
        .maybeSingle();

      if (linkError) {
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
