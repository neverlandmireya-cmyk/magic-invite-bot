import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Plus, Copy, ExternalLink, Loader2, RefreshCw, AlertCircle, MessageSquare, Check, Search, Trash2, Ban } from 'lucide-react';
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

// Logging helper
async function logActivity(action: string, entityType: string, entityId: string | null, details: Record<string, any>, performedBy: string) {
  try {
    await supabase.from('activity_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      performed_by: performedBy,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export default function Links() {
  const { isAdmin, codeUser } = useAuth();
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [userLink, setUserLink] = useState<InviteLink | null>(null);
  const [groups, setGroups] = useState<{ id: string; name?: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSettings, setHasSettings] = useState(false);
  
  // Welcome message dialog
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<InviteLink | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Delete/Ban confirmation
  const [deleteTarget, setDeleteTarget] = useState<InviteLink | null>(null);
  const [banTarget, setBanTarget] = useState<InviteLink | null>(null);

  const dashboardUrl = 'https://login.exylus.net';

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
      .select('key, value')
      .in('key', ['group_ids']); // Only fetch group_ids, not bot_token (it's now server-only)

    if (settings) {
      const groupIdsSetting = settings.find(s => s.key === 'group_ids');
      
      // Check if bot token is configured (without exposing it)
      const { count } = await supabase
        .from('settings')
        .select('*', { count: 'exact', head: true })
        .eq('key', 'bot_token');
      
      if (groupIdsSetting?.value && count && count > 0) {
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

    if (!codeUser?.accessCode) {
      toast.error('Authentication required');
      return;
    }

    setGenerating(true);

    try {
      // Call Edge Function instead of Telegram API directly
      const { data, error } = await supabase.functions.invoke('telegram-invite', {
        body: { 
          adminCode: codeUser.accessCode,
          groupId: selectedGroup,
          memberLimit: 1 
        }
      });

      if (error) {
        throw new Error('Failed to create invite link');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create invite link');
      }

      const accessCode = generateAccessCode();
      const selectedGroupData = groups.find(g => g.id === selectedGroup);

      const { data: insertedLink, error: insertError } = await supabase
        .from('invite_links')
        .insert({
          group_id: selectedGroup,
          group_name: selectedGroupData?.name || null,
          invite_link: data.invite_link,
          status: 'active',
          access_code: accessCode,
          expires_at: data.expire_date 
            ? new Date(data.expire_date * 1000).toISOString() 
            : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Log the activity
      await logActivity('generate_link', 'invite_link', insertedLink.id, {
        group_id: selectedGroup,
        group_name: selectedGroupData?.name,
        access_code: accessCode,
      }, codeUser.accessCode);

      // Show welcome message dialog
      setGeneratedLink(insertedLink);
      setShowWelcomeDialog(true);
      setCopied(false);
      
      toast.success('Invite link generated!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate link');
    }

    setGenerating(false);
  }

  async function deleteLink(link: InviteLink) {
    try {
      const { error } = await supabase
        .from('invite_links')
        .delete()
        .eq('id', link.id);

      if (error) throw error;

      await logActivity('delete_link', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
      }, codeUser?.accessCode || 'unknown');

      toast.success('Link deleted');
      setDeleteTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to delete link');
    }
  }

  async function banLink(link: InviteLink) {
    try {
      const { error } = await supabase
        .from('invite_links')
        .update({ status: 'revoked' })
        .eq('id', link.id);

      if (error) throw error;

      await logActivity('ban_link', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
        previous_status: link.status,
      }, codeUser?.accessCode || 'unknown');

      toast.success('Link banned/revoked');
      setBanTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to ban link');
    }
  }

  // Filter links based on search
  const filteredLinks = links.filter(link => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      link.access_code?.toLowerCase().includes(query) ||
      link.group_name?.toLowerCase().includes(query) ||
      link.invite_link.toLowerCase().includes(query)
    );
  });

  function getWelcomeMessage(link: InviteLink): string {
    return `Welcome!

Thanks for your purchase. Here are your access details:

Group: ${link.invite_link}

Dashboard: ${dashboardUrl}
User Code: ${link.access_code}

If you need support, access the dashboard and visit the Support section.`;
  }

  function copyWelcomeMessage() {
    if (generatedLink) {
      navigator.clipboard.writeText(getWelcomeMessage(generatedLink));
      setCopied(true);
      toast.success('Welcome message copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function copyText(text: string, label: string = 'Text') {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="border-success text-success">Active</Badge>;
      case 'used':
        return <Badge variant="outline" className="border-warning text-warning">Used</Badge>;
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

  // User view - only show their link
  if (codeUser && !isAdmin) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Your Access</h1>
          <p className="text-muted-foreground mt-1">Your personalized Telegram invite</p>
        </div>

        {userLink ? (
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Telegram Invite</CardTitle>
                {getStatusBadge(userLink.status || 'active')}
              </div>
              <CardDescription>
                {userLink.group_name || 'Telegram Group'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <code className="text-sm font-mono text-foreground break-all">
                  {userLink.invite_link}
                </code>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => copyText(userLink.invite_link, 'Link')} variant="outline" className="flex-1">
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
            </CardContent>
          </Card>
        ) : (
          <Card className="glass border-warning/30">
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertCircle className="w-10 h-10 text-warning" />
              <div>
                <h3 className="font-semibold text-foreground">No Link Found</h3>
                <p className="text-muted-foreground">
                  The invite link for your access code was not found.
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
                Configure your Bot Token and Group IDs in Settings first.
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
          <p className="text-muted-foreground mt-1">Generate and manage invite links</p>
        </div>
        <Button variant="outline" size="icon" onClick={loadData}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Generate Link Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>Generate New Link</CardTitle>
          <CardDescription>Create a single-use invite link with access code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-64 bg-input">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
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
        </CardContent>
      </Card>

      {/* Welcome Message Dialog */}
      <Dialog open={showWelcomeDialog} onOpenChange={setShowWelcomeDialog}>
        <DialogContent className="glass max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Link Generated Successfully!
            </DialogTitle>
            <DialogDescription>
              Copy this welcome message to send to your customer
            </DialogDescription>
          </DialogHeader>
          
          {generatedLink && (
            <div className="space-y-4">
              <Textarea
                readOnly
                value={getWelcomeMessage(generatedLink)}
                className="min-h-[200px] bg-muted/30 font-mono text-sm"
              />
              
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={copyWelcomeMessage} className="glow-sm">
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Message'}
                </Button>
                <Button variant="outline" onClick={() => setShowWelcomeDialog(false)}>
                  Close
                </Button>
              </div>

              <div className="p-3 rounded-lg bg-muted/20 border border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Access Code:</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-foreground">{generatedLink.access_code}</code>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => copyText(generatedLink.access_code!, 'Code')}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this invite link?
              {deleteTarget?.access_code && (
                <span className="block mt-2 font-mono text-foreground">{deleteTarget.access_code}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteLink(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={!!banTarget} onOpenChange={() => setBanTarget(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Ban/Revoke Link</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the link and mark it as banned. The user will no longer be able to use it.
              {banTarget?.access_code && (
                <span className="block mt-2 font-mono text-foreground">{banTarget.access_code}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => banTarget && banLink(banTarget)}
            >
              Ban Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Link History */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Link History</CardTitle>
              <CardDescription>{filteredLinks.length} of {links.length} links</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-input"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLinks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {links.length === 0 
                ? 'No invite links yet. Generate your first one above!'
                : 'No links match your search.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {link.group_name || 'Group'}
                      </span>
                      {getStatusBadge(link.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {link.access_code && (
                        <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {link.access_code}
                        </span>
                      )}
                      <span>{format(new Date(link.created_at), 'MMM d, yyyy HH:mm')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {link.access_code && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGeneratedLink(link);
                          setShowWelcomeDialog(true);
                          setCopied(false);
                        }}
                        title="Show welcome message"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyText(link.invite_link, 'Link')}
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
                    {link.status !== 'revoked' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setBanTarget(link)}
                        title="Ban/Revoke link"
                        className="text-warning hover:text-warning"
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(link)}
                      title="Delete link"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
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
