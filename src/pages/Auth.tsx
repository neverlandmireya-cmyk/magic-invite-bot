import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Key, Shield, ShieldOff } from 'lucide-react';
import { z } from 'zod';

const codeSchema = z.object({
  code: z.string().min(4, 'Access code must be at least 4 characters'),
});

export default function Auth() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBanned, setShowBanned] = useState(false);
  const { signInWithCode, isBanned } = useAuth();
  const navigate = useNavigate();

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = codeSchema.safeParse({ code });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    const result = await signInWithCode(code);
    
    if (result.error) {
      if (result.isBanned) {
        setShowBanned(true);
      } else {
        toast.error(result.error.message || 'Invalid access code');
      }
      setLoading(false);
    } else {
      toast.success('Access granted!');
      navigate('/links');
    }
  };

  // Show banned message
  if (showBanned || isBanned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, hsl(var(--destructive)) 0%, transparent 70%)' }}
          />
          <div 
            className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, hsl(var(--destructive)) 0%, transparent 70%)' }}
          />
        </div>

        <div className="w-full max-w-md animate-fade-in relative z-10">
          <div className="glass rounded-2xl p-8 shadow-2xl border-destructive/50">
            <div className="flex flex-col items-center mb-6">
              <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                <ShieldOff className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
              <p className="text-muted-foreground text-center mt-2">
                This user is banned
              </p>
            </div>

            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 mb-6">
              <p className="text-sm text-center text-foreground">
                Your access code has been banned from the system. 
                If you believe this is an error, please contact support.
              </p>
            </div>

            <Button 
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowBanned(false);
                setCode('');
              }}
            >
              Try Another Code
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Access Portal</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your access code</p>
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
                  placeholder="Enter your code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="pl-10 bg-input border-border focus:border-primary font-mono tracking-wider uppercase text-center text-lg"
                  required
                  autoFocus
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

          <p className="text-center text-xs text-muted-foreground mt-6">
            Use your access code to enter the system
          </p>
        </div>
      </div>
    </div>
  );
}
