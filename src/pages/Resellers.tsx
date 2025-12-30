import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Users, Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2, Coins, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border"
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
                        onClick={() => copyCode(reseller.code)}
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
                  <div className="flex items-center gap-2">
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