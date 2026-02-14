import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Link2, CheckCircle, Clock, XCircle, DollarSign, TrendingUp, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
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

export default function Dashboard() {
  const { codeUser, isAdmin, isReseller, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, expired: 0 });
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [recentRevenue, setRecentRevenue] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const handleResetRevenue = async () => {
    if (!codeUser?.accessCode) return;
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { code: codeUser.accessCode, action: 'reset-all-revenue' }
      });
      if (error) throw error;
      if (data?.success) {
        setTotalRevenue(0);
        setRecentRevenue([]);
        toast.success('Revenue reset successfully');
      }
    } catch (err) {
      toast.error('Failed to reset revenue');
    }
    setResetting(false);
  };

  useEffect(() => {
    async function fetchStats() {
      if (!codeUser?.accessCode || !isAdmin) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('data-api', {
          body: { code: codeUser.accessCode, action: 'get-dashboard-stats' }
        });

        if (error) throw error;

        if (data?.success) {
          setStats(data.stats);
          setRecentRevenue(data.recentRevenue || []);
          setTotalRevenue(data.totalRevenue || 0);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      }

      setLoading(false);
    }

    fetchStats();
  }, [codeUser, isAdmin]);

  const statCards = [
    { label: 'Total Links', value: stats.total, icon: Link2, color: 'text-primary' },
    { label: 'Active', value: stats.active, icon: Clock, color: 'text-warning' },
    { label: 'Used', value: stats.used, icon: CheckCircle, color: 'text-success' },
    { label: 'Expired', value: stats.expired, icon: XCircle, color: 'text-muted-foreground' },
  ];

  // Redirect non-admins after hooks - wait for auth AND codeUser to be resolved
  if (!authLoading && codeUser && !isAdmin) {
    if (isReseller) {
      return <Navigate to="/reseller" replace />;
    }
    return <Navigate to="/links" replace />;
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
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Reset Revenue">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Revenue?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all revenue records. This action cannot be undone. Links and users will not be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetRevenue} disabled={resetting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {resetting ? 'Resetting...' : 'Reset Revenue'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DollarSign className="w-5 h-5 text-success" />
          </div>
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
          <p>Navigate to <strong className="text-foreground">Invite Links</strong> to generate new single-use links, or visit <strong className="text-foreground">Activity Logs</strong> to see member joins and leaves.</p>
        </CardContent>
      </Card>
    </div>
  );
}
