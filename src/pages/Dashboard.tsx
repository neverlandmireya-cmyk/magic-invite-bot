import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Stats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, used: 0, expired: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
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

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your Telegram invite links</p>
      </div>

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
          <p>Navigate to <strong className="text-foreground">Invite Links</strong> to generate new single-use links, or visit <strong className="text-foreground">Settings</strong> to configure your Telegram Bot Token and Group IDs.</p>
        </CardContent>
      </Card>
    </div>
  );
}
