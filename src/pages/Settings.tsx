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
  // Command bot (for /generate, /status, etc.)
  const [commandBotToken, setCommandBotToken] = useState('');
  const [commandBotTokenMasked, setCommandBotTokenMasked] = useState('');
  const [commandBotTokenSet, setCommandBotTokenSet] = useState(false);
  const [showCommandToken, setShowCommandToken] = useState(false);
  // Link bot (for generating invite links)
  const [linkBotToken, setLinkBotToken] = useState('');
  const [linkBotTokenMasked, setLinkBotTokenMasked] = useState('');
  const [linkBotTokenSet, setLinkBotTokenSet] = useState(false);
  const [showLinkToken, setShowLinkToken] = useState(false);
  // Other settings
  const [groupIds, setGroupIds] = useState('');
  const [notificationGroupId, setNotificationGroupId] = useState('');
  const [telegramAdminIds, setTelegramAdminIds] = useState('');
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
        // Command bot (webhook)
        setCommandBotTokenSet(data.settings.command_bot_token_set === 'true');
        setCommandBotTokenMasked(data.settings.command_bot_token_masked || '');
        // Link bot (generates invites)
        setLinkBotTokenSet(data.settings.link_bot_token_set === 'true');
        setLinkBotTokenMasked(data.settings.link_bot_token_masked || '');
        // Legacy fallback: if old bot_token exists, show it as link bot
        if (!data.settings.link_bot_token_set && data.settings.bot_token_set === 'true') {
          setLinkBotTokenSet(true);
          setLinkBotTokenMasked(data.settings.bot_token_masked || '');
        }
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

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('manage-settings', {
        body: { 
          action: 'save',
          adminCode: codeUser.accessCode,
          commandBotToken: commandBotToken.trim() || undefined,
          linkBotToken: linkBotToken.trim() || undefined,
          groupIds: groupIds,
          notificationGroupId: notificationGroupId.trim(),
          telegramAdminIds: telegramAdminIds.trim()
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Settings saved successfully');
        setCommandBotToken('');
        setLinkBotToken('');
        loadSettings();
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
            Configure two bots: one for commands and one for generating invite links
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Command Bot Token */}
          <div className="space-y-2">
            <Label htmlFor="commandToken">🤖 Command Bot Token (Webhook)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Bot that receives commands like /generate, /status, etc.
            </p>
            
            {commandBotTokenSet && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Token configured: {commandBotTokenMasked}</span>
              </div>
            )}
            
            <div className="relative">
              <Input
                id="commandToken"
                type={showCommandToken ? 'text' : 'password'}
                placeholder={commandBotTokenSet ? "Enter new token to replace..." : "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"}
                value={commandBotToken}
                onChange={(e) => setCommandBotToken(e.target.value)}
                className="pr-10 bg-input font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowCommandToken(!showCommandToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCommandToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Link Bot Token */}
          <div className="space-y-2">
            <Label htmlFor="linkToken">🔗 Link Bot Token (Invite Generator)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Bot with admin rights in groups that generates invite links.
            </p>
            
            {linkBotTokenSet && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>Token configured: {linkBotTokenMasked}</span>
              </div>
            )}
            
            <div className="relative">
              <Input
                id="linkToken"
                type={showLinkToken ? 'text' : 'password'}
                placeholder={linkBotTokenSet ? "Enter new token to replace..." : "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"}
                value={linkBotToken}
                onChange={(e) => setLinkBotToken(e.target.value)}
                className="pr-10 bg-input font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowLinkToken(!showLinkToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showLinkToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
              <p className="font-medium text-foreground mb-1">Setup:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>Link Bot</strong>: Add as admin in groups with "Invite Users" permission</li>
                <li><strong>Command Bot</strong>: Configure webhook (see below)</li>
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
