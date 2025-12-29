import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface CodeUser {
  accessCode: string;
  linkId: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  codeUser: CodeUser | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithCode: (code: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CODE_USER_KEY = 'telegram_code_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithCode = async (code: string) => {
    try {
      // Verify the code exists in the database
      const { data, error } = await supabase
        .from('invite_links')
        .select('id, access_code')
        .eq('access_code', code.trim().toUpperCase())
        .maybeSingle();

      if (error) {
        return { error: new Error('Failed to verify code') };
      }

      if (!data) {
        return { error: new Error('Invalid access code') };
      }

      // Store the code user in localStorage
      const codeUserData: CodeUser = {
        accessCode: data.access_code!,
        linkId: data.id,
      };
      
      localStorage.setItem(CODE_USER_KEY, JSON.stringify(codeUserData));
      setCodeUser(codeUserData);

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    // Clear code user
    localStorage.removeItem(CODE_USER_KEY);
    setCodeUser(null);
    
    // Clear Supabase session if exists
    await supabase.auth.signOut();
  };

  const isAdmin = !!user;
  const isAuthenticated = isAdmin || !!codeUser;

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      codeUser,
      loading: loading && !codeUser, 
      isAdmin,
      signIn, 
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
