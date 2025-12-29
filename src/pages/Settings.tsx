import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Settings() {
  const [botToken, setBotToken] = useState('');
  const [groupIds, setGroupIds] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
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
      // Upsert bot token
      await supabase
        .from('settings')
        .upsert({ key: 'bot_token', value: botToken }, { onConflict: 'key' });

      // Upsert group IDs
      await supabase
        .from('settings')
        .upsert({ key: 'group_ids', value: groupIds }, { onConflict: 'key' });

      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }

    setSaving(false);
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your Telegram Bot integration</p>
      </div>

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
