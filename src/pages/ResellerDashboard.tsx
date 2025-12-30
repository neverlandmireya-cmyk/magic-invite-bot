import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Link2, CheckCircle, Clock, XCircle, Coins, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

export default function ResellerDashboard() {
  const { codeUser, refreshUser, isReseller, isAdmin, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, expired: 0 });
  const [credits, setCredits] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (codeUser?.accessCode && isReseller) {
      fetchStats();
    } else if (!authLoading && codeUser && !isReseller) {
      setLoading(false);
    }
  }, [codeUser, isReseller, authLoading]);

  const fetchStats = async () => {
    if (!codeUser?.accessCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-api', {
        body: { code: codeUser.accessCode, action: 'get-reseller-dashboard' }
      });

      if (error) {
        console.error('Error fetching reseller dashboard:', error);
        throw error;
      }

      if (data?.success) {
        setStats(data.stats);
        setCredits(data.credits || 0);
        setGroupName(data.groupName || '');
      } else {
        console.error('Failed to fetch reseller data:', data?.error);
      }
    } catch (error) {
      console.error('Failed to fetch reseller stats:', error);
    }

    setLoading(false);
  };

  const statCards = [
    { label: 'Total Links', value: stats.total, icon: Link2, color: 'text-primary' },
    { label: 'Active', value: stats.active, icon: Clock, color: 'text-warning' },
    { label: 'Used', value: stats.used, icon: CheckCircle, color: 'text-success' },
    { label: 'Expired', value: stats.expired, icon: XCircle, color: 'text-muted-foreground' },
  ];

  // Redirect non-resellers after hooks
  if (!authLoading && !isReseller) {
    if (isAdmin) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/links" replace />;
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reseller Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome, {codeUser?.resellerName || 'Reseller'}
        </p>
      </div>

      {/* Credits and Group Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Credits
            </CardTitle>
            <Coins className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">
              {loading ? '...' : credits}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              1 credit = 1 invite link
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-success/30 bg-success/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Group
            </CardTitle>
            <Users className="w-5 h-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success truncate">
              {loading ? '...' : (groupName || 'Not assigned')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your links will be generated for this group
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
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

      <Card className="glass">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground">
          <p>
            Navigate to <strong className="text-foreground">Invite Links</strong> to generate new links for your clients, 
            or visit <strong className="text-foreground">Activity Logs</strong> to track member joins and leaves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}