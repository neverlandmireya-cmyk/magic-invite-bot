import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Key, RefreshCw, Copy, Save, Eye, EyeOff, Shield } from 'lucide-react';

function generateCode(length: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function AdminCodes() {
  const [adminCode, setAdminCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminCode();
  }, []);

  async function loadAdminCode() {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'admin_code')
      .maybeSingle();

    if (data?.value) {
      setAdminCode(data.value);
    }
    setLoading(false);
  }

  const handleGenerateCode = () => {
    const newCode = generateCode();
    setAdminCode(newCode);
    setShowCode(true);
  };

  const handleSave = async () => {
    if (!adminCode.trim()) {
      toast.error('Admin code cannot be empty');
      return;
    }

    if (adminCode.length < 6) {
      toast.error('Admin code must be at least 6 characters');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'admin_code', value: adminCode.toUpperCase() }, { onConflict: 'key' });

      if (error) throw error;

      toast.success('Admin code saved successfully!');
    } catch (error) {
      toast.error('Failed to save admin code');
    }

    setSaving(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(adminCode);
    toast.success('Admin code copied to clipboard');
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Access</h1>
        <p className="text-muted-foreground mt-1">Manage your admin access code</p>
      </div>

      <Card className="glass border-primary/30">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>Admin Access Code</CardTitle>
              <CardDescription>
                This code grants full admin access to the system
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="adminCode">Current Admin Code</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="adminCode"
                  type={showCode ? 'text' : 'password'}
                  placeholder="Enter admin code"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
                  className="pl-10 pr-10 bg-input font-mono text-lg tracking-widest uppercase h-12"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={copyCode} className="flex-1">
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </Button>
            <Button variant="outline" onClick={handleGenerateCode} className="flex-1">
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate New
            </Button>
          </div>

          <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
            <p className="text-sm text-warning font-medium mb-1">⚠️ Important</p>
            <p className="text-sm text-muted-foreground">
              If you change the admin code, you'll need to use the new code to log in next time. 
              Make sure to save it somewhere safe!
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 glow-sm">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Admin Code'}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <span>The admin code is used to log in to the admin panel</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Anyone with this code has full access (dashboard, links, settings)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>User access codes (generated with invite links) only see their own link</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
