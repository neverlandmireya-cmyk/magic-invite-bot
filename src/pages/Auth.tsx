import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Key, Shield, ChevronDown, ChevronUp, Lock, Mail } from 'lucide-react';
import { z } from 'zod';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const codeSchema = z.object({
  code: z.string().min(6, 'Access code must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Auth() {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const { signInWithCode, signIn } = useAuth();
  const navigate = useNavigate();

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = codeSchema.safeParse({ code });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signInWithCode(code);
    
    if (error) {
      toast.error(error.message || 'Invalid access code');
      setLoading(false);
    } else {
      toast.success('Access granted!');
      navigate('/links');
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error('Invalid credentials. Admin access only.');
      setLoading(false);
    } else {
      toast.success('Welcome back, Admin!');
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'var(--gradient-glow)' }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'var(--gradient-glow)' }}
        />
      </div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 glow-sm">
              <Key className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Access Portal</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your access code to continue</p>
          </div>

          <form onSubmit={handleCodeSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium text-foreground">
                Access Code
              </Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="code"
                  type="text"
                  placeholder="Enter your access code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="pl-10 bg-input border-border focus:border-primary font-mono tracking-wider uppercase"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold glow-sm"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Access'}
            </Button>
          </form>

          <div className="mt-8">
            <Collapsible open={showAdminLogin} onOpenChange={setShowAdminLogin}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Admin Login
                  {showAdminLogin ? (
                    <ChevronUp className="w-4 h-4 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 ml-2" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <form onSubmit={handleAdminSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 bg-input border-border focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 bg-input border-border focus:border-primary"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Admin Sign In'}
                  </Button>
                </form>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Use your access code to view your invite link
          </p>
        </div>
      </div>
    </div>
  );
}
