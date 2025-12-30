import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link2, CheckCircle, Clock, XCircle, DollarSign, TrendingUp, Activity, UserPlus, UserMinus, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface Stats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

interface RevenueEntry {
  id: string;
  access_code: string;
  amount: number;
  description: string | null;
  created_at: string;
}

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
    user_id?: number;
    reason?: string;
    telegram_revoked?: boolean;
    note?: string;
  } | null;
  performed_by: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, expired: 0 });
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [recentRevenue, setRecentRevenue] = useState<RevenueEntry[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      // Fetch link stats
      const { data, error } = await supabase
        .from('invite_links')
        .select('status');

      if (!error && data) {
        const counts = data.reduce((acc, link) => {
          acc[link.status as keyof Stats]++;
          acc.total++;
          return acc;
        }, { total: 0, active: 0, used: 0, expired: 0 } as Stats);
        setStats(counts);
      }

      // Fetch revenue data
      const { data: revenueData } = await supabase
        .from('revenue')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (revenueData) {
        setRecentRevenue(revenueData);
        
        // Get all revenue for total
        const { data: allRevenue } = await supabase
          .from('revenue')
          .select('amount');
        
        if (allRevenue) {
          const grandTotal = allRevenue.reduce((sum, r) => sum + Number(r.amount), 0);
          setTotalRevenue(grandTotal);
        }
      }

      // Fetch activity logs (member joins, leaves, auto-revokes)
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .in('action', ['member_joined', 'member_left', 'auto_revoke_on_leave'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsData) {
        setActivityLogs(logsData as ActivityLog[]);
      }

      setLoading(false);
    }

    fetchStats();
  }, []);

  const statCards = [
    { label: 'Total Links', value: stats.total, icon: Link2, color: 'text-primary' },
    { label: 'Active', value: stats.active, icon: Clock, color: 'text-warning' },
    { label: 'Used', value: stats.used, icon: CheckCircle, color: 'text-success' },
    { label: 'Expired', value: stats.expired, icon: XCircle, color: 'text-muted-foreground' },
  ];

  function getActivityIcon(action: string) {
    switch (action) {
      case 'member_joined':
        return <UserPlus className="w-4 h-4 text-success" />;
      case 'member_left':
        return <UserMinus className="w-4 h-4 text-warning" />;
      case 'auto_revoke_on_leave':
        return <ShieldOff className="w-4 h-4 text-destructive" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  }

  function getActivityBadge(action: string) {
    switch (action) {
      case 'member_joined':
        return <Badge variant="outline" className="border-success text-success text-xs">Joined</Badge>;
      case 'member_left':
        return <Badge variant="outline" className="border-warning text-warning text-xs">Left</Badge>;
      case 'auto_revoke_on_leave':
        return <Badge variant="outline" className="border-destructive text-destructive text-xs">Auto-Revoked</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{action}</Badge>;
    }
  }

  function getActivityDescription(log: ActivityLog): string {
    const username = log.details?.username || log.details?.first_name || `User ${log.details?.user_id}`;
    const accessCode = log.details?.access_code;
    const groupName = log.details?.group_name || 'group';

    switch (log.action) {
      case 'member_joined':
        return `${username} joined ${groupName}${accessCode ? ` using code ${accessCode}` : ''}`;
      case 'member_left':
        return `${username} left ${groupName}`;
      case 'auto_revoke_on_leave':
        return `Link ${accessCode} auto-revoked (${username} left ${groupName})`;
      default:
        return log.action;
    }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your Telegram invite links</p>
      </div>

      {/* Revenue Card */}
      <Card className="glass border-success/30 bg-success/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Revenue
          </CardTitle>
          <DollarSign className="w-5 h-5 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-success">
            ${loading ? '...' : totalRevenue.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            From all generated links
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="glass animate-slide-up">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">
                  {loading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Member Activity Log */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <CardTitle>Member Activity</CardTitle>
          </div>
          <CardDescription>Recent joins, leaves, and auto-revokes from Telegram</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No member activity recorded yet. Activity will appear when members join or leave groups.
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="mt-0.5">
                    {getActivityIcon(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getActivityBadge(log.action)}
                      {log.details?.access_code && (
                        <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {log.details.access_code}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-1">
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

      {/* Recent Revenue */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <CardTitle>Recent Revenue</CardTitle>
          </div>
          <CardDescription>Latest transactions from link sales</CardDescription>
        </CardHeader>
        <CardContent>
          {recentRevenue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No revenue recorded yet. Generate links with prices to track revenue.
            </p>
          ) : (
            <div className="space-y-3">
              {recentRevenue.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {entry.access_code}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-success">
                      ${Number(entry.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>Navigate to <strong className="text-foreground">Invite Links</strong> to generate new single-use links, or visit <strong className="text-foreground">Settings</strong> to configure your Telegram Bot Token and Group IDs.</p>
        </CardContent>
      </Card>
    </div>
  );
}
