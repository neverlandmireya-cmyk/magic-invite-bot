import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Eye, EyeOff, AlertCircle, CheckCircle2, Bell, Bot } from 'lucide-react';

export default function Settings() {
  const { codeUser } = useAuth();
  const [botToken, setBotToken] = useState('');
  const [botTokenMasked, setBotTokenMasked] = useState('');
  const [botTokenSet, setBotTokenSet] = useState(false);
  const [groupIds, setGroupIds] = useState('');
  const [notificationGroupId, setNotificationGroupId] = useState('');
  const [telegramAdminIds, setTelegramAdminIds] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [codeUser]);

  async function loadSettings() {
    if (!codeUser?.accessCode) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('manage-settings', {
        body: { 
          action: 'get',
          adminCode: codeUser.accessCode
        }
      });

      if (error) throw error;

      if (data?.success && data.settings) {
        setBotTokenSet(data.settings.bot_token_set === 'true');
        setBotTokenMasked(data.settings.bot_token_masked || '');
        setGroupIds(data.settings.group_ids || '');
        setNotificationGroupId(data.settings.notification_group_id || '');
        setTelegramAdminIds(data.settings.telegram_admin_ids || '');
      }
    } catch (error) {
      console.error('Failed to load settings');
      toast.error('Failed to load settings');
    }

    setLoading(false);
  }

  const handleSave = async () => {
    if (!codeUser?.accessCode) {
      toast.error('Authentication required');
      return;
    }

    // If no new token is entered but one exists, only update group IDs
    if (!botToken.trim() && !botTokenSet) {
      toast.error('Bot token is required');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-settings', {
        body: { 
          action: 'save',
          adminCode: codeUser.accessCode,
          botToken: botToken.trim() || undefined, // Only send if user entered new token
          groupIds: groupIds,
          notificationGroupId: notificationGroupId.trim(),
          telegramAdminIds: telegramAdminIds.trim()
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Settings saved successfully');
        setBotToken(''); // Clear the input after save
        loadSettings(); // Reload to get updated masked token
      } else {
        throw new Error(data?.error || 'Failed to save');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
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
            
            {botTokenSet && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Token configured: {botTokenMasked}</span>
              </div>
            )}
            
            <div className="relative">
              <Input
                id="token"
                type={showToken ? 'text' : 'password'}
                placeholder={botTokenSet ? "Enter new token to replace..." : "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"}
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
              Get this from @BotFather on Telegram. {botTokenSet && "Leave empty to keep current token."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="groups">Group/Channel IDs</Label>
            <Textarea
              id="groups"
              placeholder='[{"id":"-1001234567890","name":"Group Name"}]'
              value={groupIds}
              onChange={(e) => setGroupIds(e.target.value)}
              className="bg-input font-mono text-sm min-h-[120px]"
            />
            <p className="text-xs text-muted-foreground">
              JSON array format: {`[{"id":"-100xxx","name":"Name"}]`}. Use @userinfobot to get IDs.
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

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Telegram Bot Commands
          </CardTitle>
          <CardDescription>
            Allow managing links directly from Telegram using bot commands
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegramAdminIds">Authorized Telegram User IDs</Label>
            <Input
              id="telegramAdminIds"
              placeholder="123456789, 987654321"
              value={telegramAdminIds}
              onChange={(e) => setTelegramAdminIds(e.target.value)}
              className="bg-input font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated Telegram user IDs allowed to use bot commands. 
              Send /myid to the bot to get your ID.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex gap-3">
            <Bot className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Available Commands:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><code>/generate</code> - Generate invite link</li>
                <li><code>/status [code]</code> - Check link status</li>
                <li><code>/revoke [code]</code> - Revoke a link</li>
                <li><code>/stats</code> - View statistics</li>
                <li><code>/myid</code> - Get your Telegram ID</li>
              </ul>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="glow-sm">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Get notified when resellers open new support tickets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notificationGroup">Notification Group ID</Label>
            <Input
              id="notificationGroup"
              placeholder="-1001234567890"
              value={notificationGroupId}
              onChange={(e) => setNotificationGroupId(e.target.value)}
              className="bg-input font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              The bot will send a message to this group when a reseller opens a new ticket.
              Add the bot to the group first, then use @userinfobot to get the Chat ID.
            </p>
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
