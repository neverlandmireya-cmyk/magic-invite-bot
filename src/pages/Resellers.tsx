import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Users, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Coins, Copy, Check, ArrowLeft, MessageSquare, Activity, Link as LinkIcon, Ban, ShieldCheck, Send, Loader2, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Reseller {
  id: string;
  code: string;
  name: string;
  credits: number;
  group_id: string;
  group_name: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface GroupOption {
  id: string;
  name: string;
}

interface Ticket {
  id: string;
  access_code: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at?: string;
}

interface TicketReply {
  id: string;
  ticket_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  performed_by: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

interface InviteLink {
  id: string;
  access_code: string;
  status: string;
  client_email: string | null;
  created_at: string;
  invite_link: string;
  group_name: string | null;
}

interface ResellerDetails {
  reseller: Reseller;
  tickets: Ticket[];
  logs: ActivityLog[];
  links: InviteLink[];
}

export default function Resellers() {
  const { codeUser } = useAuth();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [newReseller, setNewReseller] = useState({ name: '', credits: 5, groupId: '' });
  const [creditsToAdd, setCreditsToAdd] = useState(5);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Detail view state
  const [viewingReseller, setViewingReseller] = useState<ResellerDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Ban functionality
  const [banTarget, setBanTarget] = useState<InviteLink | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<InviteLink | null>(null);
  
  // Ticket detail view
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchResellers();
    fetchGroups();
  }, [codeUser]);

  const fetchGroups = async () => {
    if (!codeUser?.accessCode) return;

    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { code: codeUser.accessCode, action: 'get-settings' }
      });

      if (error) throw error;

      if (data?.success && data.settings) {
        const groupIds = data.settings.find((s: { key: string }) => s.key === 'group_ids');
        if (groupIds?.value) {
          try {
            const parsed = JSON.parse(groupIds.value);
            setGroups(parsed.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
          } catch {
            console.error('Failed to parse group_ids');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  };

  const fetchResellers = async () => {
    if (!codeUser?.accessCode) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { code: codeUser.accessCode, action: 'get-resellers' }
      });

      if (error) throw error;

      if (data?.success) {
        setResellers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch resellers:', error);
      toast.error('Failed to load resellers');
    }

    setLoading(false);
  };

  const fetchResellerDetails = async (reseller: Reseller) => {
    if (!codeUser?.accessCode) return;

    setLoadingDetails(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'get-reseller-details',
          data: { resellerCode: reseller.code }
        }
      });

      if (error) throw error;

      if (data?.success) {
        setViewingReseller({
          reseller: data.reseller,
          tickets: data.tickets || [],
          logs: data.logs || [],
          links: data.links || []
        });
      }
    } catch (error) {
      console.error('Failed to fetch reseller details:', error);
      toast.error('Failed to load reseller details');
    }
    setLoadingDetails(false);
  };

  // Load ticket replies
  const loadTicketReplies = async (ticketId: string) => {
    if (!codeUser?.accessCode) return;

    setLoadingReplies(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'get-ticket-replies',
          data: { ticketId }
        }
      });

      if (error) throw error;

      if (data?.success) {
        setTicketReplies(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load replies:', error);
    }
    setLoadingReplies(false);
  };

  // Send reply to ticket
  const sendTicketReply = async () => {
    if (!selectedTicket || !codeUser?.accessCode || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const { error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'insert-ticket-reply',
          data: {
            ticketId: selectedTicket.id,
            message: replyMessage.trim(),
          }
        }
      });

      if (error) throw error;

      setReplyMessage('');
      loadTicketReplies(selectedTicket.id);
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast.error('Failed to send reply');
    }
    setSendingReply(false);
  };

  // Update ticket status
  const updateTicketStatus = async (ticketId: string, status: string) => {
    if (!codeUser?.accessCode) return;

    try {
      const { error } = await supabase.functions.invoke('data-api', {
        body: { 
          code: codeUser.accessCode, 
          action: 'update-ticket',
          data: { id: ticketId, updates: { status } }
        }
      });

      if (error) throw error;

      toast.success('Status updated');
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status });
      }
      // Refresh reseller details to update ticket list
      if (viewingReseller) {
        fetchResellerDetails(viewingReseller.reseller);
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Open ticket detail view
  const openTicketDetail = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    loadTicketReplies(ticket.id);
  };

  // Close ticket detail view
  const closeTicketDetail = () => {
    setSelectedTicket(null);
    setTicketReplies([]);
    setReplyMessage('');
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async () => {
    if (!newReseller.name.trim() || !newReseller.groupId) {
      toast.error('Please fill all fields');
      return;
    }

    const selectedGroup = groups.find(g => g.id === newReseller.groupId);
    const code = generateCode();

    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser?.accessCode,
          action: 'insert-reseller',
          data: {
            code,
            name: newReseller.name.trim(),
            credits: newReseller.credits,
            group_id: newReseller.groupId,
            group_name: selectedGroup?.name || '',
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Reseller created with code: ${code}`);
        setCreateOpen(false);
        setNewReseller({ name: '', credits: 5, groupId: '' });
        fetchResellers();
      } else {
        throw new Error(data?.error || 'Failed to create reseller');
      }
    } catch (error) {
      console.error('Failed to create reseller:', error);
      toast.error('Failed to create reseller');
    }
  };

  const handleToggleActive = async (reseller: Reseller) => {
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser?.accessCode,
          action: 'update-reseller',
          data: { id: reseller.id, updates: { is_active: !reseller.is_active } }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(reseller.is_active ? 'Reseller deactivated' : 'Reseller activated');
        fetchResellers();
      }
    } catch (error) {
      console.error('Failed to toggle reseller:', error);
      toast.error('Failed to update reseller');
    }
  };

  const handleDelete = async (reseller: Reseller) => {
    if (!confirm(`Delete reseller "${reseller.name}"? This cannot be undone.`)) return;

    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser?.accessCode,
          action: 'delete-reseller',
          data: { id: reseller.id }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Reseller deleted');
        fetchResellers();
      }
    } catch (error) {
      console.error('Failed to delete reseller:', error);
      toast.error('Failed to delete reseller');
    }
  };

  const handleAddCredits = async () => {
    if (!selectedReseller || creditsToAdd < 1) return;

    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser?.accessCode,
          action: 'add-reseller-credits',
          data: { id: selectedReseller.id, amount: creditsToAdd }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Added ${creditsToAdd} credits. New balance: ${data.newCredits}`);
        setAddCreditsOpen(false);
        setSelectedReseller(null);
        setCreditsToAdd(5);
        fetchResellers();
      }
    } catch (error) {
      console.error('Failed to add credits:', error);
      toast.error('Failed to add credits');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copied!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="outline" className="border-success text-success">Open</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>;
      case 'closed':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'member_joined':
        return 'text-success';
      case 'member_left':
        return 'text-warning';
      case 'auto_revoke_on_leave':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'member_joined':
        return 'Joined';
      case 'member_left':
        return 'Left';
      case 'auto_revoke_on_leave':
        return 'Revoked';
      default:
        return action;
    }
  };

  const getLinkStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="border-success text-success">Active</Badge>;
      case 'used':
        return <Badge variant="outline" className="border-primary text-primary">Used</Badge>;
      case 'banned':
        return <Badge variant="outline" className="border-destructive text-destructive">Banned</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="border-warning text-warning">Revoked</Badge>;
      case 'closed_by_telegram':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Ban user - revoke Telegram link and mark as banned
  const handleBanUser = async (link: InviteLink) => {
    if (!codeUser?.accessCode) return;

    try {
      // Revoke on Telegram
      if (link.invite_link) {
        const { data: revokeData } = await supabase.functions.invoke('telegram-revoke', {
          body: {
            adminCode: codeUser.accessCode,
            inviteLink: link.invite_link
          }
        });
        
        if (revokeData?.success) {
          console.log('Link revoked on Telegram');
        }
      }

      // Update status to banned
      const { data: updateResponse, error } = await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser.accessCode,
          action: 'update-link',
          data: { id: link.id, updates: { status: 'banned' } }
        }
      });

      if (error || !updateResponse?.success) {
        throw new Error(updateResponse?.error || 'Failed to ban user');
      }

      // Log activity
      await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser.accessCode,
          action: 'insert-activity-log',
          data: {
            action: 'admin_ban_reseller_user',
            entity_type: 'invite_link',
            entity_id: link.id,
            details: {
              access_code: link.access_code,
              reseller_code: viewingReseller?.reseller.code,
              group_name: link.group_name,
            }
          }
        }
      });

      toast.success('User banned successfully');
      setBanTarget(null);
      
      // Refresh the reseller details
      if (viewingReseller) {
        fetchResellerDetails(viewingReseller.reseller);
      }
    } catch (error) {
      toast.error('Failed to ban user');
    }
  };

  // Unban user - restore status to revoked
  const handleUnbanUser = async (link: InviteLink) => {
    if (!codeUser?.accessCode) return;

    try {
      const { data: updateResponse, error } = await supabase.functions.invoke('data-api', {
        body: {
          code: codeUser.accessCode,
          action: 'update-link',
          data: { id: link.id, updates: { status: 'revoked' } }
        }
      });

      if (error || !updateResponse?.success) {
        throw new Error(updateResponse?.error || 'Failed to unban user');
      }

      toast.success('User unbanned - can now regenerate link');
      setUnbanTarget(null);
      
      // Refresh the reseller details
      if (viewingReseller) {
        fetchResellerDetails(viewingReseller.reseller);
      }
    } catch (error) {
      toast.error('Failed to unban user');
    }
  };

  // Detail view
  if (viewingReseller) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setViewingReseller(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{viewingReseller.reseller.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={() => copyCode(viewingReseller.reseller.code)}
                className="flex items-center gap-1 font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors"
              >
                {viewingReseller.reseller.code}
                {copiedCode === viewingReseller.reseller.code ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <Badge variant={viewingReseller.reseller.is_active ? "default" : "secondary"}>
                {viewingReseller.reseller.is_active ? 'Active' : 'Inactive'}
              </Badge>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Coins className="w-3 h-3" />
                {viewingReseller.reseller.credits} credits
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Links Generated</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{viewingReseller.links.length}</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {viewingReseller.tickets.filter(t => t.status === 'open').length}
              </div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{viewingReseller.tickets.length}</div>
            </CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Group</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium truncate">
                {viewingReseller.reseller.group_name || viewingReseller.reseller.group_id}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tickets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Tickets ({viewingReseller.tickets.length})
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity ({viewingReseller.logs.length})
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              Links ({viewingReseller.links.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="mt-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Customer Tickets</CardTitle>
                <CardDescription>Click a ticket to view details and respond</CardDescription>
              </CardHeader>
              <CardContent>
                {viewingReseller.tickets.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tickets from this reseller's customers</p>
                ) : (
                  <div className="space-y-3">
                    {viewingReseller.tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => openTicketDetail(ticket)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium text-foreground truncate">{ticket.subject}</span>
                            {getStatusBadge(ticket.status)}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {ticket.access_code}
                            </span>
                            <span>{format(new Date(ticket.created_at), 'MMM d, yyyy HH:mm')}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Activity Logs</CardTitle>
                <CardDescription>Recent activity for this reseller's links</CardDescription>
              </CardHeader>
              <CardContent>
                {viewingReseller.logs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No activity logs for this reseller</p>
                ) : (
                  <div className="space-y-2">
                    {viewingReseller.logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={getActionColor(log.action)}>
                            {getActionLabel(log.action)}
                          </Badge>
                          <span className="font-mono text-sm text-muted-foreground">
                            {log.performed_by}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, HH:mm')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="mt-4">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-lg">Generated Links</CardTitle>
                <CardDescription>Links created by this reseller - Ban or unban users here</CardDescription>
              </CardHeader>
              <CardContent>
                {viewingReseller.links.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No links generated by this reseller</p>
                ) : (
                  <div className="space-y-2">
                    {viewingReseller.links.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {link.access_code}
                          </span>
                          {getLinkStatusBadge(link.status)}
                          {link.client_email && (
                            <span className="text-sm text-muted-foreground truncate">{link.client_email}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(link.created_at), 'MMM d, yyyy')}
                          </span>
                          {/* Ban/Unban buttons */}
                          {link.status === 'banned' ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-success hover:text-success hover:bg-success/10"
                              onClick={() => setUnbanTarget(link)}
                              title="Unban User"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </Button>
                          ) : link.status !== 'revoked' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setBanTarget(link)}
                              title="Ban User"
                            >
                              <Ban className="w-4 h-4" />
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

        {/* Ban Confirmation Dialog */}
        <AlertDialog open={!!banTarget} onOpenChange={() => setBanTarget(null)}>
          <AlertDialogContent className="glass border-destructive/30">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Ban className="w-5 h-5" />
                Ban User
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will revoke the Telegram invite link and block the user from accessing the group.
                {banTarget?.access_code && (
                  <span className="block mt-2 font-mono text-foreground bg-destructive/10 px-2 py-1 rounded">
                    {banTarget.access_code}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => banTarget && handleBanUser(banTarget)}
              >
                <Ban className="w-4 h-4 mr-2" />
                Ban User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Unban Confirmation Dialog */}
        <AlertDialog open={!!unbanTarget} onOpenChange={() => setUnbanTarget(null)}>
          <AlertDialogContent className="glass">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-success">
                <ShieldCheck className="w-5 h-5" />
                Unban User
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will unban the user and allow regeneration of their link. They will be moved to "Revoked" status.
                {unbanTarget?.access_code && (
                  <span className="block mt-2 font-mono text-foreground bg-success/10 px-2 py-1 rounded">
                    {unbanTarget.access_code}
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={() => unbanTarget && handleUnbanUser(unbanTarget)}
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Unban User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && closeTicketDetail()}>
          <DialogContent className="glass max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5" />
                {selectedTicket?.subject}
              </DialogTitle>
              <div className="flex items-center gap-3 pt-2">
                {selectedTicket && getStatusBadge(selectedTicket.status)}
                <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                  {selectedTicket?.access_code}
                </span>
                <span className="text-xs text-muted-foreground">
                  {selectedTicket && format(new Date(selectedTicket.created_at), 'MMM d, yyyy HH:mm')}
                </span>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-4 py-4">
              {/* Original message */}
              <Card className="bg-muted/30 border-border">
                <CardContent className="pt-4">
                  <p className="text-foreground whitespace-pre-wrap">{selectedTicket?.message}</p>
                </CardContent>
              </Card>

              {/* Replies */}
              {loadingReplies ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                ticketReplies.map((reply) => (
                  <div
                    key={reply.id}
                    className={`p-4 rounded-lg ${
                      reply.is_admin 
                        ? 'bg-primary/10 border border-primary/20 ml-8' 
                        : 'bg-muted/30 border border-border mr-8'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-foreground">
                        {reply.is_admin ? 'Admin' : 'Customer'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(reply.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{reply.message}</p>
                  </div>
                ))
              )}
            </div>

            {/* Status controls and reply form */}
            <div className="border-t border-border pt-4 space-y-4">
              {/* Status selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Select 
                  value={selectedTicket?.status || 'open'} 
                  onValueChange={(v) => selectedTicket && updateTicketStatus(selectedTicket.id, v)}
                >
                  <SelectTrigger className="w-32 bg-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reply form */}
              {selectedTicket?.status !== 'closed' && (
                <div className="flex gap-3">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    className="bg-input min-h-[80px] flex-1"
                    maxLength={5000}
                  />
                  <Button 
                    onClick={sendTicketReply} 
                    disabled={sendingReply || !replyMessage.trim()}
                    className="glow-sm"
                  >
                    {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resellers</h1>
          <p className="text-muted-foreground mt-1">Manage reseller accounts and credits</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Add Reseller
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Reseller</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Reseller name"
                  value={newReseller.name}
                  onChange={(e) => setNewReseller({ ...newReseller, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Initial Credits</Label>
                <Input
                  type="number"
                  min="0"
                  value={newReseller.credits}
                  onChange={(e) => setNewReseller({ ...newReseller, credits: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">1 credit = 1 invite link</p>
              </div>
              <div className="space-y-2">
                <Label>Assigned Group</Label>
                <Select
                  value={newReseller.groupId}
                  onValueChange={(value) => setNewReseller({ ...newReseller, groupId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Create Reseller</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Resellers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{resellers.length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{resellers.filter(r => r.is_active).length}</div>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{resellers.reduce((sum, r) => sum + r.credits, 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Resellers List */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>All Resellers</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={fetchResellers}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Loading...</p>
          ) : resellers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No resellers yet. Create your first reseller to get started.</p>
          ) : (
            <div className="space-y-3">
              {resellers.map((reseller) => (
                <div
                  key={reseller.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => fetchResellerDetails(reseller)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{reseller.name}</span>
                      <Badge variant={reseller.is_active ? "default" : "secondary"}>
                        {reseller.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyCode(reseller.code); }}
                        className="flex items-center gap-1 font-mono bg-primary/10 text-primary px-2 py-0.5 rounded hover:bg-primary/20 transition-colors"
                      >
                        {reseller.code}
                        {copiedCode === reseller.code ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <span>Group: {reseller.group_name || reseller.group_id}</span>
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3" />
                        {reseller.credits} credits
                      </span>
                    </div>
                    {reseller.last_used_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last used: {format(new Date(reseller.last_used_at), 'MMM d, yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedReseller(reseller);
                        setAddCreditsOpen(true);
                      }}
                    >
                      <Coins className="w-4 h-4 mr-1" />
                      Add Credits
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(reseller)}
                    >
                      {reseller.is_active ? (
                        <ToggleRight className="w-5 h-5 text-success" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(reseller)}
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

      {/* Add Credits Dialog */}
      <Dialog open={addCreditsOpen} onOpenChange={setAddCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Credits to {selectedReseller?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Credits to Add</Label>
              <Input
                type="number"
                min="1"
                value={creditsToAdd}
                onChange={(e) => setCreditsToAdd(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Current balance: {selectedReseller?.credits || 0} credits
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCreditsOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCredits}>Add {creditsToAdd} Credits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}