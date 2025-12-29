import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, AlertCircle, Key, RefreshCw, Copy } from 'lucide-react';

function generateAdminCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function Settings() {
  const [botToken, setBotToken] = useState('');
  const [groupIds, setGroupIds] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAdminCode, setSavingAdminCode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      const { data } = await supabase
        .from('settings')
        .select('key, value');

      if (data) {
        data.forEach((setting) => {
          if (setting.key === 'bot_token') setBotToken(setting.value);
          if (setting.key === 'group_ids') setGroupIds(setting.value);
          if (setting.key === 'admin_code') setAdminCode(setting.value);
        });
      }
      setLoading(false);
    }

    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!botToken.trim()) {
      toast.error('Bot token is required');
      return;
    }

    setSaving(true);

    try {
      await supabase
        .from('settings')
        .upsert({ key: 'bot_token', value: botToken }, { onConflict: 'key' });

      await supabase
        .from('settings')
        .upsert({ key: 'group_ids', value: groupIds }, { onConflict: 'key' });

      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }

    setSaving(false);
  };

  const handleGenerateAdminCode = () => {
    const newCode = generateAdminCode();
    setAdminCode(newCode);
  };

  const handleSaveAdminCode = async () => {
    if (!adminCode.trim()) {
      toast.error('Admin code is required');
      return;
    }

    setSavingAdminCode(true);

    try {
      await supabase
        .from('settings')
        .upsert({ key: 'admin_code', value: adminCode.toUpperCase() }, { onConflict: 'key' });

      toast.success('Admin code saved! Use this code to log in as admin.');
    } catch (error) {
      toast.error('Failed to save admin code');
    }

    setSavingAdminCode(false);
  };

  const copyAdminCode = () => {
    navigator.clipboard.writeText(adminCode);
    toast.success('Admin code copied to clipboard');
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your system settings</p>
      </div>

      {/* Admin Access Code Section */}
      <Card className="glass border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Admin Access Code
          </CardTitle>
          <CardDescription>
            Set the master code to access the admin panel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminCode">Current Admin Code</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="adminCode"
                  type={showAdminCode ? 'text' : 'password'}
                  placeholder="Enter admin code"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value.toUpperCase())}
                  className="pr-10 bg-input font-mono text-lg tracking-widest uppercase"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminCode(!showAdminCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showAdminCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button variant="outline" size="icon" onClick={copyAdminCode} title="Copy code">
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleGenerateAdminCode} title="Generate new code">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this code to log in to the admin panel. Keep it secure!
            </p>
          </div>

          <Button onClick={handleSaveAdminCode} disabled={savingAdminCode} className="glow-sm">
            <Save className="w-4 h-4 mr-2" />
            {savingAdminCode ? 'Saving...' : 'Save Admin Code'}
          </Button>
        </CardContent>
      </Card>

      {/* Telegram Bot Configuration */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Telegram Bot Configuration</CardTitle>
          <CardDescription>
            Enter your bot token and group IDs to enable invite link generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="token">Bot Token</Label>
            <div className="relative">
              <Input
                id="token"
                type={showToken ? 'text' : 'password'}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="pr-10 bg-input font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get this from @BotFather on Telegram
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groups">Group/Channel IDs</Label>
            <Textarea
              id="groups"
              placeholder="-1001234567890&#10;-1009876543210"
              value={groupIds}
              onChange={(e) => setGroupIds(e.target.value)}
              className="bg-input font-mono text-sm min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              One ID per line. Use @userinfobot or similar to get group/channel IDs.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex gap-3">
            <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Important Setup Steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Add your bot as an admin in the group/channel</li>
                <li>Grant "Invite Users via Link" permission</li>
                <li>For channels, enable "Sign Messages" if needed</li>
              </ol>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="glow-sm">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
