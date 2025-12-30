import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, UserPlus, UserMinus, ShieldOff, RefreshCw, Filter, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: {
    access_code?: string;
    username?: string;
    first_name?: string;
    group_name?: string;
    group_id?: string;
    user_id?: number;
    reason?: string;
    telegram_revoked?: boolean;
    note?: string;
  } | null;
  performed_by: string;
  created_at: string;
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'member_joined' | 'member_left' | 'auto_revoke_on_leave'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  async function fetchLogs() {
    setLoading(true);
    
    let query = supabase
      .from('activity_logs')
      .select('*')
      .in('action', ['member_joined', 'member_left', 'auto_revoke_on_leave'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (filter !== 'all') {
      query = supabase
        .from('activity_logs')
        .select('*')
        .eq('action', filter)
        .order('created_at', { ascending: false })
        .limit(100);
    }

    const { data } = await query;
    if (data) {
      setLogs(data as ActivityLog[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  function getActivityIcon(action: string) {
    switch (action) {
      case 'member_joined':
        return <UserPlus className="w-5 h-5 text-success" />;
      case 'member_left':
        return <UserMinus className="w-5 h-5 text-warning" />;
      case 'auto_revoke_on_leave':
        return <ShieldOff className="w-5 h-5 text-destructive" />;
      default:
        return <Activity className="w-5 h-5 text-muted-foreground" />;
    }
  }

  function getActivityBadge(action: string) {
    switch (action) {
      case 'member_joined':
        return <Badge variant="outline" className="border-success text-success">Joined</Badge>;
      case 'member_left':
        return <Badge variant="outline" className="border-warning text-warning">Left</Badge>;
      case 'auto_revoke_on_leave':
        return <Badge variant="outline" className="border-destructive text-destructive">Auto-Revoked</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  }

  function getActivityDescription(log: ActivityLog): string {
    const username = log.details?.username 
      ? `@${log.details.username}` 
      : log.details?.first_name || `User ${log.details?.user_id}`;
    const accessCode = log.details?.access_code;
    const groupName = log.details?.group_name || 'group';

    switch (log.action) {
      case 'member_joined':
        return `${username} joined "${groupName}"${accessCode ? ` using code ${accessCode}` : ''}`;
      case 'member_left':
        return `${username} left "${groupName}"`;
      case 'auto_revoke_on_leave':
        return `Link ${accessCode} was automatically revoked because ${username} left "${groupName}"`;
      default:
        return log.action;
    }
  }

  // Filter logs by search query
  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return log.details?.access_code?.toLowerCase().includes(query);
  });

  const joinedCount = filteredLogs.filter(l => l.action === 'member_joined').length;
  const leftCount = filteredLogs.filter(l => l.action === 'member_left').length;
  const revokedCount = filteredLogs.filter(l => l.action === 'auto_revoke_on_leave').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activity Logs</h1>
          <p className="text-muted-foreground mt-1">Member joins, leaves, and auto-revokes from Telegram</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserPlus className="w-8 h-8 text-success" />
              <div>
                <p className="text-2xl font-bold text-success">{joinedCount}</p>
                <p className="text-sm text-muted-foreground">Members Joined</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass border-warning/30 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <UserMinus className="w-8 h-8 text-warning" />
              <div>
                <p className="text-2xl font-bold text-warning">{leftCount}</p>
                <p className="text-sm text-muted-foreground">Members Left</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldOff className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold text-destructive">{revokedCount}</p>
                <p className="text-sm text-muted-foreground">Auto-Revoked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <CardTitle>Recent Activity</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-40 pl-9 bg-input"
                />
              </div>
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-40 bg-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="member_joined">Joined</SelectItem>
                  <SelectItem value="member_left">Left</SelectItem>
                  <SelectItem value="auto_revoke_on_leave">Auto-Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription>Showing last 100 events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">
              {searchQuery ? `No logs found for "${searchQuery}"` : 'No activity recorded yet. Events will appear when members join or leave your Telegram groups.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getActivityIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getActivityBadge(log.action)}
                      {log.details?.access_code && (
                        <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {log.details.access_code}
                        </span>
                      )}
                      {log.details?.group_name && (
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {log.details.group_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground">
                      {getActivityDescription(log)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </p>
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
