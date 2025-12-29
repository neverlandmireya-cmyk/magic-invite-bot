import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Key, RefreshCw, Copy, Plus, Trash2, Eye, EyeOff, UserCog, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface AdminCode {
  id: string;
  code: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

function generateCode(length: number = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function AdminCodes() {
  const [admins, setAdmins] = useState<AdminCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});
  
  // New admin form
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadAdmins();
  }, []);

  async function loadAdmins() {
    const { data, error } = await supabase
      .from('admin_codes')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setAdmins(data);
    }
    setLoading(false);
  }

  const handleGenerateCode = () => {
    setNewCode(generateCode());
  };

  const handleCreateAdmin = async () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }

    if (!newCode.trim() || newCode.length < 6) {
      toast.error('Code must be at least 6 characters');
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase
        .from('admin_codes')
        .insert({
          name: newName.trim(),
          code: newCode.toUpperCase(),
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This code already exists. Generate a new one.');
        } else {
          throw error;
        }
      } else {
        toast.success(`Admin "${newName}" created!`);
        setNewName('');
        setNewCode('');
        setDialogOpen(false);
        loadAdmins();
      }
    } catch (error) {
      toast.error('Failed to create admin');
    }

    setCreating(false);
  };

  const toggleActive = async (admin: AdminCode) => {
    try {
      await supabase
        .from('admin_codes')
        .update({ is_active: !admin.is_active })
        .eq('id', admin.id);

      toast.success(admin.is_active ? 'Admin deactivated' : 'Admin activated');
      loadAdmins();
    } catch (error) {
      toast.error('Failed to update admin');
    }
  };

  const deleteAdmin = async (admin: AdminCode) => {
    if (admins.length <= 1) {
      toast.error('Cannot delete the last admin');
      return;
    }

    try {
      await supabase
        .from('admin_codes')
        .delete()
        .eq('id', admin.id);

      toast.success(`Admin "${admin.name}" deleted`);
      loadAdmins();
    } catch (error) {
      toast.error('Failed to delete admin');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const toggleShowCode = (id: string) => {
    setShowCodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Management</h1>
          <p className="text-muted-foreground mt-1">Create and manage admin access codes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="glow-sm" onClick={() => { setNewCode(generateCode()); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="glass">
            <DialogHeader>
              <DialogTitle>Create New Admin</DialogTitle>
              <DialogDescription>
                Create a new admin access code. Share the code with the person to give them admin access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Admin Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. John, Manager, etc."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Access Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="Access code"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="bg-input font-mono tracking-wider uppercase"
                  />
                  <Button variant="outline" size="icon" onClick={handleGenerateCode}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdmin} disabled={creating}>
                {creating ? 'Creating...' : 'Create Admin'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {admins.length === 0 ? (
          <Card className="glass">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No admins yet. Create your first one!</p>
            </CardContent>
          </Card>
        ) : (
          admins.map((admin) => (
            <Card key={admin.id} className={`glass ${!admin.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCog className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{admin.name}</span>
                      {admin.is_active ? (
                        <Badge variant="outline" className="border-success text-success">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted-foreground text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span className="font-mono flex items-center gap-1">
                        <Key className="w-3 h-3" />
                        {showCodes[admin.id] ? admin.code : '••••••••••'}
                      </span>
                      {admin.last_used_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Last used: {format(new Date(admin.last_used_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleShowCode(admin.id)}
                    title={showCodes[admin.id] ? 'Hide code' : 'Show code'}
                  >
                    {showCodes[admin.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyCode(admin.code)}
                    title="Copy code"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleActive(admin)}
                    title={admin.is_active ? 'Deactivate' : 'Activate'}
                  >
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${admin.is_active ? 'border-warning text-warning' : 'border-success text-success'}`}
                    >
                      {admin.is_active ? 'Off' : 'On'}
                    </Badge>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAdmin(admin)}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete admin"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
              <span>Create an admin with a unique name and access code</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
              <span>Share the code with that person - they use it to log in</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
              <span>All admins have full access (dashboard, links, settings)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
              <span>Deactivate or delete admins anytime to revoke access</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
