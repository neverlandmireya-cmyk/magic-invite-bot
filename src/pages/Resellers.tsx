import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Users, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Coins, Copy, Check, ArrowLeft, MessageSquare, Activity, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
                <CardDescription>Tickets from customers whose links were created by this reseller</CardDescription>
              </CardHeader>
              <CardContent>
                {viewingReseller.tickets.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No tickets from this reseller's customers</p>
                ) : (
                  <div className="space-y-3">
                    {viewingReseller.tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
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
                <CardDescription>Links created by this reseller</CardDescription>
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
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {link.access_code}
                          </span>
                          <Badge variant="outline">{link.status}</Badge>
                          {link.client_email && (
                            <span className="text-sm text-muted-foreground">{link.client_email}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(link.created_at), 'MMM d, yyyy')}
                        </span>
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