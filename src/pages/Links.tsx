import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Copy, ExternalLink, Loader2, RefreshCw, AlertCircle, Key } from 'lucide-react';
import { format } from 'date-fns';

interface InviteLink {
  id: string;
  group_id: string;
  group_name: string | null;
  invite_link: string;
  status: string;
  created_at: string;
  used_at: string | null;
  expires_at: string | null;
  access_code: string | null;
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function Links() {
  const { user, isAdmin, codeUser } = useAuth();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [userLink, setUserLink] = useState<InviteLink | null>(null);
  const [groups, setGroups] = useState<{ id: string; name?: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [codeUser]);

  async function loadData() {
    setLoading(true);

    // If user logged in with a code, fetch only their link
    if (codeUser && !isAdmin) {
      const { data: linkData } = await supabase
        .from('invite_links')
        .select('*')
        .eq('access_code', codeUser.accessCode)
        .maybeSingle();

      if (linkData) {
        setUserLink(linkData);
      }
      setLoading(false);
      return;
    }

    // Admin flow - load settings and all links
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value');

    if (settings) {
      const groupIdsSetting = settings.find(s => s.key === 'group_ids');
      const botToken = settings.find(s => s.key === 'bot_token');
      
      if (groupIdsSetting?.value && botToken?.value) {
        setHasSettings(true);
        try {
          const parsedGroups = JSON.parse(groupIdsSetting.value);
          setGroups(parsedGroups);
          if (parsedGroups.length > 0) setSelectedGroup(parsedGroups[0].id);
        } catch {
          const ids = groupIdsSetting.value.split('\n').filter(Boolean).map(id => ({ id: id.trim() }));
          setGroups(ids);
          if (ids.length > 0) setSelectedGroup(ids[0].id);
        }
      }
    }

    const { data: linksData } = await supabase
      .from('invite_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (linksData) {
      setLinks(linksData);
    }

    setLoading(false);
  }

  async function generateLink() {
    if (!selectedGroup) {
      toast.error('Please select a group');
      return;
    }

    setGenerating(true);
    setGeneratedCode(null);

    try {
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value');

      const botToken = settings?.find(s => s.key === 'bot_token')?.value;

      if (!botToken) {
        toast.error('Bot token not configured');
        setGenerating(false);
        return;
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/createChatInviteLink`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: selectedGroup,
            member_limit: 1,
            creates_join_request: false,
          }),
        }
      );

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.description || 'Failed to create invite link');
      }

      // Generate unique access code
      const accessCode = generateAccessCode();
      const selectedGroupData = groups.find(g => g.id === selectedGroup);

      const { error } = await supabase
        .from('invite_links')
        .insert({
          group_id: selectedGroup,
          group_name: selectedGroupData?.name || null,
          invite_link: result.result.invite_link,
          status: 'active',
          created_by: user?.id,
          access_code: accessCode,
          expires_at: result.result.expire_date 
            ? new Date(result.result.expire_date * 1000).toISOString() 
            : null,
        });

      if (error) throw error;

      setGeneratedCode(accessCode);
      toast.success('Invite link generated with access code!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate link');
    }

    setGenerating(false);
  }

  function copyText(text: string, label: string = 'Link') {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="border-warning text-warning">Active</Badge>;
      case 'used':
        return <Badge variant="outline" className="border-success text-success">Used</Badge>;
      case 'expired':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Expired</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="border-destructive text-destructive">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Code user view - only show their link
  if (codeUser && !isAdmin) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Your Invite Link</h1>
          <p className="text-muted-foreground mt-1">Access your personalized Telegram invite</p>
        </div>

        {userLink ? (
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Telegram Invite</CardTitle>
                {getStatusBadge(userLink.status || 'active')}
              </div>
              <CardDescription>
                {userLink.group_name || `Group ${userLink.group_id}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <code className="text-sm font-mono text-foreground break-all">
                  {userLink.invite_link}
                </code>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => copyText(userLink.invite_link)} variant="outline" className="flex-1">
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
                <Button asChild className="flex-1 glow-sm">
                  <a href={userLink.invite_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Join Group
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Created: {format(new Date(userLink.created_at), 'MMM d, yyyy HH:mm')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass border-warning/30">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertCircle className="w-10 h-10 text-warning" />
              <div>
                <h3 className="font-semibold text-foreground">No Link Found</h3>
                <p className="text-muted-foreground">
                  The invite link associated with your access code could not be found.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Admin view
  if (!hasSettings) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invite Links</h1>
          <p className="text-muted-foreground mt-1">Generate single-use invite links</p>
        </div>

        <Card className="glass border-warning/30">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="w-10 h-10 text-warning" />
            <div>
              <h3 className="font-semibold text-foreground">Configuration Required</h3>
              <p className="text-muted-foreground">
                Please configure your Bot Token and Group IDs in Settings before generating links.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invite Links</h1>
          <p className="text-muted-foreground mt-1">Generate and manage single-use invite links</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Generate New Link</CardTitle>
          <CardDescription>Create a single-use invite link with access code</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-64 bg-input">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name || group.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={generateLink} disabled={generating} className="glow-sm">
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Generate Link
            </Button>
          </div>

          {generatedCode && (
            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-3 mb-2">
                <Key className="w-5 h-5 text-success" />
                <span className="font-semibold text-success">Access Code Generated!</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold tracking-widest text-foreground bg-background/50 px-4 py-2 rounded">
                  {generatedCode}
                </code>
                <Button size="sm" variant="outline" onClick={() => copyText(generatedCode, 'Access code')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Share this code with the user so they can access their invite link.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Link History</CardTitle>
          <CardDescription>{links.length} invite links generated</CardDescription>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No invite links generated yet. Create your first one above!
            </p>
          ) : (
            <div className="space-y-3">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <code className="text-sm font-mono text-foreground truncate max-w-md">
                        {link.invite_link}
                      </code>
                      {getStatusBadge(link.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Group: {link.group_name || link.group_id}</span>
                      {link.access_code && (
                        <span className="font-mono bg-muted px-2 py-0.5 rounded">
                          Code: {link.access_code}
                        </span>
                      )}
                      <span>Created: {format(new Date(link.created_at), 'MMM d, yyyy HH:mm')}</span>
                      {link.used_at && (
                        <span>Used: {format(new Date(link.used_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.access_code && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyText(link.access_code!, 'Access code')}
                        title="Copy access code"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyText(link.invite_link)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                    >
                      <a href={link.invite_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
