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
import { Plus, Copy, ExternalLink, Loader2, RefreshCw, AlertCircle, MessageSquare, Check, Search, Trash2, Ban, UserX, Unlink, ShieldOff, ShieldCheck, DollarSign, UserCog, Mail, IdCard, FileText, Upload, Image, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  client_email: string | null;
  client_id: string | null;
  receipt_url: string | null;
  note: string | null;
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
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [prohibitedFilter, setProhibitedFilter] = useState<'all' | 'removed' | 'banned'>('all');
  
  // Delete/Ban/Revoke/Regenerate/Unban confirmation
  const [deleteTarget, setDeleteTarget] = useState<InviteLink | null>(null);
  const [banTarget, setBanTarget] = useState<InviteLink | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteLink | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<InviteLink | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<InviteLink | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  
  // Account deleted dialog
  const [showAccountDeletedDialog, setShowAccountDeletedDialog] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  
  // Price input for link generation
  const [linkPrice, setLinkPrice] = useState<string>('');
  const [showPriceDialog, setShowPriceDialog] = useState(false);
  
  // Delete user (permanent)
  const [deleteUserTarget, setDeleteUserTarget] = useState<InviteLink | null>(null);
  
  // Edit client info
  const [editClientTarget, setEditClientTarget] = useState<InviteLink | null>(null);
  const [clientEmail, setClientEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientNote, setClientNote] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [savingClientInfo, setSavingClientInfo] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

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

  function openPriceDialog() {
    if (!selectedGroup) {
      toast.error('Please select a group');
      return;
    }
    setLinkPrice('');
    setShowPriceDialog(true);
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

    const price = parseFloat(linkPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Please enter a valid price');
      return;
    }

    setGenerating(true);
    setShowPriceDialog(false);

    try {
      // Generate the access code first so we can include it in the Telegram link name
      const accessCode = generateAccessCode();
      const selectedGroupData = groups.find(g => g.id === selectedGroup);

      // Call Edge Function with access code to set as link name in Telegram
      const { data, error } = await supabase.functions.invoke('telegram-invite', {
        body: { 
          adminCode: codeUser.accessCode,
          groupId: selectedGroup,
          memberLimit: 1,
          accessCode: accessCode // Pass code to be used as link name
        }
      });

      if (error) {
        throw new Error('Failed to create invite link');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create invite link');
      }

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

      // Add revenue record
      if (price > 0) {
        await supabase.from('revenue').insert({
          link_id: insertedLink.id,
          access_code: accessCode,
          amount: price,
          description: `Link generated for ${selectedGroupData?.name || selectedGroup}`,
          created_by: codeUser.accessCode,
        });
      }

      // Log the activity
      await logActivity('generate_link', 'invite_link', insertedLink.id, {
        group_id: selectedGroup,
        group_name: selectedGroupData?.name,
        access_code: accessCode,
        price: price,
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

  // Delete user permanently (revokes Telegram link, removes revenue, removes from panel)
  async function deleteUserPermanently(link: InviteLink) {
    try {
      // First, revoke the link on Telegram
      if (codeUser?.accessCode && link.group_id && link.invite_link) {
        await supabase.functions.invoke('telegram-revoke', {
          body: { 
            adminCode: codeUser.accessCode,
            groupId: link.group_id,
            inviteLink: link.invite_link
          }
        });
      }

      // Delete associated revenue entries
      if (link.access_code) {
        await supabase
          .from('revenue')
          .delete()
          .eq('access_code', link.access_code);
      }

      // Delete the link record
      const { error } = await supabase
        .from('invite_links')
        .delete()
        .eq('id', link.id);

      if (error) throw error;

      await logActivity('delete_user', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
        action: 'permanent_deletion',
        telegram_revoked: true,
        revenue_deleted: true,
      }, codeUser?.accessCode || 'unknown');

      toast.success('User deleted permanently (Telegram link revoked, revenue removed)');
      setDeleteUserTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to delete user');
    }
  }

  // Delete from panel only (no Telegram action)
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

      toast.success('Link deleted from panel');
      setDeleteTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to delete link');
    }
  }

  // Revoke on Telegram only (keeps record in panel with revoked status)
  async function revokeOnTelegram(link: InviteLink) {
    try {
      if (!codeUser?.accessCode) {
        toast.error('Authentication required');
        return;
      }

      const { data: revokeData, error } = await supabase.functions.invoke('telegram-revoke', {
        body: { 
          adminCode: codeUser.accessCode,
          groupId: link.group_id,
          inviteLink: link.invite_link
        }
      });

      if (error) throw error;

      // Update status in database
      await supabase
        .from('invite_links')
        .update({ status: 'revoked' })
        .eq('id', link.id);

      await logActivity('revoke_telegram', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
        telegram_response: revokeData?.success ? 'success' : revokeData?.warning,
      }, codeUser.accessCode);

      if (revokeData?.success) {
        toast.success('Link revoked on Telegram');
      } else {
        toast.warning('Link may already be revoked on Telegram');
      }
      
      setRevokeTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to revoke link on Telegram');
    }
  }

  // Regenerate link - create new Telegram link for same access code
  async function regenerateLink(link: InviteLink) {
    if (!codeUser?.accessCode) {
      toast.error('Authentication required');
      return;
    }

    setRegenerating(true);

    try {
      // First revoke the old link on Telegram (optional, best practice)
      if (link.invite_link) {
        await supabase.functions.invoke('telegram-revoke', {
          body: { 
            adminCode: codeUser.accessCode,
            groupId: link.group_id,
            inviteLink: link.invite_link
          }
        });
      }

      // Generate new link with same access code
      const { data, error } = await supabase.functions.invoke('telegram-invite', {
        body: { 
          adminCode: codeUser.accessCode,
          groupId: link.group_id,
          memberLimit: 1,
          accessCode: link.access_code
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to create new link');

      // Update the database record with new link
      const { error: updateError } = await supabase
        .from('invite_links')
        .update({ 
          invite_link: data.invite_link,
          status: 'active',
          expires_at: data.expire_date 
            ? new Date(data.expire_date * 1000).toISOString() 
            : null,
        })
        .eq('id', link.id);

      if (updateError) throw updateError;

      await logActivity('regenerate_link', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
        old_link: link.invite_link,
        new_link: data.invite_link,
      }, codeUser.accessCode);

      toast.success('New link generated!');
      setRegenerateTarget(null);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate link');
    }

    setRegenerating(false);
  }

  // Ban link - revoke on Telegram AND mark as BANNED in panel (blocks access code) AND remove revenue
  async function banLink(link: InviteLink) {
    try {
      if (codeUser?.accessCode && link.group_id && link.invite_link) {
        const { data: revokeData } = await supabase.functions.invoke('telegram-revoke', {
          body: { 
            adminCode: codeUser.accessCode,
            groupId: link.group_id,
            inviteLink: link.invite_link
          }
        });
        
        if (revokeData?.success) {
          console.log('Link revoked on Telegram');
        } else if (revokeData?.warning) {
          console.log('Telegram revoke warning:', revokeData.warning);
        }
      }

      // Delete associated revenue entries
      if (link.access_code) {
        await supabase
          .from('revenue')
          .delete()
          .eq('access_code', link.access_code);
      }

      const { error } = await supabase
        .from('invite_links')
        .update({ status: 'banned' })
        .eq('id', link.id);

      if (error) throw error;

      await logActivity('ban_link', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
        previous_status: link.status,
        revoked_on_telegram: true,
        revenue_deleted: true,
      }, codeUser?.accessCode || 'unknown');

      toast.success('User banned - access code blocked, revenue removed');
      setBanTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to ban user');
    }
  }

  // Unban link - restore status to allow regeneration
  async function unbanLink(link: InviteLink) {
    try {
      const { error } = await supabase
        .from('invite_links')
        .update({ status: 'revoked' })
        .eq('id', link.id);

      if (error) throw error;

      await logActivity('unban_link', 'invite_link', link.id, {
        access_code: link.access_code,
        group_name: link.group_name,
        previous_status: link.status,
      }, codeUser?.accessCode || 'unknown');

      toast.success('User unbanned - can now regenerate link');
      setUnbanTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to unban user');
    }
  }

  async function submitAccountDeletedTicket() {
    if (!codeUser?.accessCode) {
      toast.error('Authentication required');
      return;
    }

    setSubmittingTicket(true);

    try {
      const { error } = await supabase.from('tickets').insert({
        access_code: codeUser.accessCode,
        subject: 'Account Deletion Request',
        message: `Hello, my Telegram account was deleted and I need assistance to regain access to the group. My access code is: ${codeUser.accessCode}. Please help me resolve this issue.`,
        priority: 'high',
        status: 'open',
      });

      if (error) throw error;

      toast.success('Ticket submitted successfully! We will contact you soon.');
      setShowAccountDeletedDialog(false);
    } catch (error: any) {
      toast.error('Failed to submit ticket. Please try again.');
    }

    setSubmittingTicket(false);
  }

  function openEditClientDialog(link: InviteLink) {
    setEditClientTarget(link);
    setClientEmail(link.client_email || '');
    setClientId(link.client_id || '');
    setClientNote(link.note || '');
    setReceiptFile(null);
    setReceiptPreview(link.receipt_url || null);
  }

  function handleReceiptSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  }

  function clearReceipt() {
    setReceiptFile(null);
    setReceiptPreview(editClientTarget?.receipt_url || null);
  }

  async function saveClientInfo() {
    if (!editClientTarget) return;
    
    setSavingClientInfo(true);
    
    try {
      let receiptUrl = editClientTarget.receipt_url;

      // Upload receipt if a new file was selected
      if (receiptFile) {
        setUploadingReceipt(true);
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${editClientTarget.id}-${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);

        receiptUrl = urlData.publicUrl;
        setUploadingReceipt(false);
      }

      const { error } = await supabase
        .from('invite_links')
        .update({
          client_email: clientEmail.trim() || null,
          client_id: clientId.trim() || null,
          note: clientNote.trim() || null,
          receipt_url: receiptUrl,
        })
        .eq('id', editClientTarget.id);

      if (error) throw error;

      await logActivity('update_client_info', 'invite_link', editClientTarget.id, {
        access_code: editClientTarget.access_code,
        client_email: clientEmail.trim() || null,
        client_id: clientId.trim() || null,
        note: clientNote.trim() || null,
        receipt_uploaded: !!receiptFile,
      }, codeUser?.accessCode || 'unknown');

      toast.success('Client info updated');
      setEditClientTarget(null);
      loadData();
    } catch (error: any) {
      toast.error('Failed to update client info');
      setUploadingReceipt(false);
    }
    
    setSavingClientInfo(false);
  }

  // Separate active and prohibited (removed + banned) links
  const activeLinks = links.filter(link => link.status !== 'revoked' && link.status !== 'banned');
  const revokedLinks = links.filter(link => link.status === 'revoked');
  const bannedLinks = links.filter(link => link.status === 'banned');
  
  // Combined prohibited links based on filter
  const prohibitedLinks = prohibitedFilter === 'all' 
    ? [...revokedLinks, ...bannedLinks]
    : prohibitedFilter === 'removed' 
      ? revokedLinks 
      : bannedLinks;

  // Filter links based on search
  const filteredActiveLinks = activeLinks.filter(link => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      link.access_code?.toLowerCase().includes(query) ||
      link.group_name?.toLowerCase().includes(query) ||
      link.invite_link.toLowerCase().includes(query)
    );
  });

  const filteredProhibitedLinks = prohibitedLinks.filter(link => {
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
        return <Badge variant="outline" className="border-orange-500 text-orange-500">Removed</Badge>;
      case 'banned':
        return <Badge variant="outline" className="border-destructive text-destructive">Banned</Badge>;
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
            </CardHeader>
            <CardContent className="space-y-4">
              {userLink.group_name && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Group</p>
                    <p className="text-lg font-semibold text-primary">{userLink.group_name}</p>
                  </div>
                </div>
              )}
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

        {/* Account Deleted Button */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={() => setShowAccountDeletedDialog(true)}
            >
              <UserX className="w-4 h-4 mr-2" />
              My account was deleted
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Click here if your Telegram account was deleted and you need help
            </p>
          </CardContent>
        </Card>

        {/* Account Deleted Dialog */}
        <Dialog open={showAccountDeletedDialog} onOpenChange={setShowAccountDeletedDialog}>
          <DialogContent className="glass max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <UserX className="w-5 h-5" />
                Account Deleted?
              </DialogTitle>
              <DialogDescription>
                We're sorry to hear that. Don't worry, we can help you regain access.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm text-foreground">
                  By clicking the button below, a support ticket will be automatically created with your access code. Our team will review your case and help you get back into the group as soon as possible.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={submitAccountDeletedTicket}
                  disabled={submittingTicket}
                >
                  {submittingTicket ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  )}
                  Send Support Request
                </Button>
                <Button variant="outline" onClick={() => setShowAccountDeletedDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <Button onClick={openPriceDialog} disabled={generating} className="glow-sm">
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
            <AlertDialogTitle>Delete from Panel</AlertDialogTitle>
            <AlertDialogDescription>
              This will only delete the record from the panel. The link on Telegram will NOT be affected.
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
              Delete from Panel
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
              This will revoke the link on Telegram AND mark it as banned in the panel. The user will no longer be able to use it.
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

      {/* Revoke on Telegram Only Dialog */}
      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke on Telegram</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the link on Telegram only. The record will remain in the panel with "revoked" status.
              {revokeTarget?.access_code && (
                <span className="block mt-2 font-mono text-foreground">{revokeTarget.access_code}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-500 text-white hover:bg-orange-600"
              onClick={() => revokeTarget && revokeOnTelegram(revokeTarget)}
            >
              <Unlink className="w-4 h-4 mr-2" />
              Revoke on Telegram
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Link Dialog */}
      <AlertDialog open={!!regenerateTarget} onOpenChange={() => setRegenerateTarget(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Link</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke the old link and generate a new Telegram invite link for the same access code.
              {regenerateTarget?.access_code && (
                <span className="block mt-2 font-mono text-foreground">{regenerateTarget.access_code}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => regenerateTarget && regenerateLink(regenerateTarget)}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unban Confirmation Dialog */}
      <AlertDialog open={!!unbanTarget} onOpenChange={() => setUnbanTarget(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle>Unban User</AlertDialogTitle>
            <AlertDialogDescription>
              This will unban the user and allow you to regenerate their link. The user will be moved to the "Removed" section.
              {unbanTarget?.access_code && (
                <span className="block mt-2 font-mono text-foreground">{unbanTarget.access_code}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-success text-success-foreground hover:bg-success/90"
              onClick={() => unbanTarget && unbanLink(unbanTarget)}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              Unban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Price Input Dialog */}
      <Dialog open={showPriceDialog} onOpenChange={setShowPriceDialog}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-success" />
              Enter Price
            </DialogTitle>
            <DialogDescription>
              How much does this link cost?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={linkPrice}
                onChange={(e) => setLinkPrice(e.target.value)}
                className="pl-9 bg-input text-lg font-mono"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={generateLink} 
                disabled={generating}
                className="flex-1 glow-sm"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Generate Link
              </Button>
              <Button variant="outline" onClick={() => setShowPriceDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Permanently Dialog */}
      <AlertDialog open={!!deleteUserTarget} onOpenChange={() => setDeleteUserTarget(null)}>
        <AlertDialogContent className="glass">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete User Permanently</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user's access. This action cannot be undone.
              {deleteUserTarget?.access_code && (
                <span className="block mt-2 font-mono text-foreground">{deleteUserTarget.access_code}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUserTarget && deleteUserPermanently(deleteUserTarget)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Client Info Dialog */}
      <Dialog open={!!editClientTarget} onOpenChange={() => setEditClientTarget(null)}>
        <DialogContent className="glass max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="w-5 h-5 text-primary" />
              Client Information
            </DialogTitle>
            <DialogDescription>
              Add or edit client details (admin only)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {editClientTarget?.access_code && (
              <div className="p-2 rounded bg-muted/30 border border-border">
                <span className="text-xs text-muted-foreground">Access Code:</span>
                <span className="font-mono text-sm ml-2 text-foreground">{editClientTarget.access_code}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                Client Email
              </label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="bg-input"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <IdCard className="w-4 h-4 text-muted-foreground" />
                Client ID
              </label>
              <Input
                type="text"
                placeholder="e.g., telegram username or ID"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="bg-input"
              />
            </div>

            {/* Payment Receipt Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Image className="w-4 h-4 text-muted-foreground" />
                Payment Receipt
              </label>
              
              {receiptPreview ? (
                <div className="relative">
                  <img 
                    src={receiptPreview} 
                    alt="Receipt preview" 
                    className="w-full h-40 object-cover rounded-lg border border-border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={clearReceipt}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/30 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Click to upload receipt</span>
                  <span className="text-xs text-muted-foreground/70 mt-1">PNG, JPG up to 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleReceiptSelect}
                  />
                </label>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Note
              </label>
              <Textarea
                placeholder="Add any notes about this client..."
                value={clientNote}
                onChange={(e) => setClientNote(e.target.value)}
                className="bg-input min-h-[80px]"
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={saveClientInfo} 
                disabled={savingClientInfo || uploadingReceipt}
                className="flex-1 glow-sm"
              >
                {(savingClientInfo || uploadingReceipt) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {uploadingReceipt ? 'Uploading...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setEditClientTarget(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Links with Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="active" className="gap-2">
              Active
              {activeLinks.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">{activeLinks.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="prohibited" className="gap-2">
              <ShieldOff className="w-4 h-4" />
              Prohibited
              {(revokedLinks.length + bannedLinks.length) > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">{revokedLinks.length + bannedLinks.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-input"
            />
          </div>
        </div>

        {/* Active Links Tab */}
        <TabsContent value="active">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Active Links</CardTitle>
              <CardDescription>{filteredActiveLinks.length} of {activeLinks.length} links</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredActiveLinks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {activeLinks.length === 0 
                    ? 'No active invite links. Generate your first one above!'
                    : 'No links match your search.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredActiveLinks.map((link) => (
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
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {link.access_code && (
                            <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {link.access_code}
                            </span>
                          )}
                          <span>{format(new Date(link.created_at), 'MMM d, yyyy HH:mm')}</span>
                          {(link.client_email || link.client_id) && (
                            <span className="flex items-center gap-2 text-muted-foreground/80">
                              {link.client_email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {link.client_email}
                                </span>
                              )}
                              {link.client_id && (
                                <span className="flex items-center gap-1">
                                  <IdCard className="w-3 h-3" />
                                  {link.client_id}
                                </span>
                              )}
                            </span>
                          )}
                          {link.receipt_url && (
                            <span className="flex items-center gap-1 text-success">
                              <Image className="w-3 h-3" />
                              Receipt
                            </span>
                          )}
                          {link.note && (
                            <span className="flex items-center gap-1 text-muted-foreground/80">
                              <FileText className="w-3 h-3" />
                              Note
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Edit client info */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditClientDialog(link)}
                          title="Edit client info"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <UserCog className="w-4 h-4" />
                        </Button>
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
                          title="Copy link"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Open link"
                        >
                          <a href={link.invite_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        {/* Regenerate - create new link for same access code */}
                        {link.access_code && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRegenerateTarget(link)}
                            title="Regenerate link (new Telegram link, same code)"
                            className="text-primary hover:text-primary"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Revoke on Telegram only */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRevokeTarget(link)}
                          title="Revoke on Telegram only"
                          className="text-orange-500 hover:text-orange-600"
                        >
                          <Unlink className="w-4 h-4" />
                        </Button>
                        {/* Ban - revoke on Telegram + mark as banned */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setBanTarget(link)}
                          title="Ban (revoke on Telegram + mark banned)"
                          className="text-warning hover:text-warning"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                        {/* Delete user permanently */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteUserTarget(link)}
                          title="Delete user permanently"
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
        </TabsContent>

        {/* Prohibited Links Tab (Combined Removed + Banned) */}
        <TabsContent value="prohibited">
          <Card className="glass border-destructive/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldOff className="w-5 h-5 text-destructive" />
                  <div>
                    <CardTitle>Prohibited Codes</CardTitle>
                    <CardDescription>{filteredProhibitedLinks.length} of {revokedLinks.length + bannedLinks.length} codes</CardDescription>
                  </div>
                </div>
                {/* Filter buttons */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                  <Button
                    variant={prohibitedFilter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setProhibitedFilter('all')}
                    className="text-xs h-7 px-2"
                  >
                    All ({revokedLinks.length + bannedLinks.length})
                  </Button>
                  <Button
                    variant={prohibitedFilter === 'removed' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setProhibitedFilter('removed')}
                    className="text-xs h-7 px-2 text-orange-500"
                  >
                    <Unlink className="w-3 h-3 mr-1" />
                    Removed ({revokedLinks.length})
                  </Button>
                  <Button
                    variant={prohibitedFilter === 'banned' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setProhibitedFilter('banned')}
                    className="text-xs h-7 px-2 text-destructive"
                  >
                    <Ban className="w-3 h-3 mr-1" />
                    Banned ({bannedLinks.length})
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredProhibitedLinks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {(revokedLinks.length + bannedLinks.length) === 0 
                    ? 'No prohibited codes yet.'
                    : 'No codes match your search or filter.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredProhibitedLinks.map((link) => (
                    <div
                      key={link.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        link.status === 'banned' 
                          ? 'bg-destructive/10 border-destructive/30' 
                          : 'bg-orange-500/10 border-orange-500/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {link.group_name || 'Group'}
                          </span>
                          {getStatusBadge(link.status)}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {link.access_code && (
                            <span className={`font-mono px-2 py-0.5 rounded ${
                              link.status === 'banned' 
                                ? 'bg-destructive/10 text-destructive' 
                                : 'bg-orange-500/10 text-orange-500'
                            }`}>
                              {link.access_code}
                            </span>
                          )}
                          <span>{format(new Date(link.created_at), 'MMM d, yyyy HH:mm')}</span>
                          {(link.client_email || link.client_id) && (
                            <span className="flex items-center gap-2 text-muted-foreground/80">
                              {link.client_email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {link.client_email}
                                </span>
                              )}
                              {link.client_id && (
                                <span className="flex items-center gap-1">
                                  <IdCard className="w-3 h-3" />
                                  {link.client_id}
                                </span>
                              )}
                            </span>
                          )}
                          {link.receipt_url && (
                            <span className="flex items-center gap-1 text-success">
                              <Image className="w-3 h-3" />
                              Receipt
                            </span>
                          )}
                          {link.note && (
                            <span className="flex items-center gap-1 text-muted-foreground/80">
                              <FileText className="w-3 h-3" />
                              Note
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Edit client info */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditClientDialog(link)}
                          title="Edit client info"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <UserCog className="w-4 h-4" />
                        </Button>
                        {/* Unban - only for banned users */}
                        {link.status === 'banned' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setUnbanTarget(link)}
                            title="Unban user (move to Removed)"
                            className="text-success hover:text-success"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </Button>
                        )}
                        {/* Regenerate - restore access with new link */}
                        {link.access_code && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setRegenerateTarget(link)}
                            title="Generate new link (same code)"
                            className="text-primary hover:text-primary"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
