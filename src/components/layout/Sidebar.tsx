import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { 
  Link2, 
  Settings, 
  LogOut, 
  LayoutDashboard,
  Shield,
  Key,
  UserCog,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const adminNavItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/links', label: 'Invite Links', icon: Link2 },
  { path: '/admin-codes', label: 'Admin Access', icon: UserCog },
  { path: '/support', label: 'Ticket', icon: HelpCircle },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const userNavItems = [
  { path: '/links', label: 'My Invite', icon: Link2 },
  { path: '/support', label: 'Ticket', icon: HelpCircle },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, isAdmin, codeUser } = useAuth();

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {isAdmin ? (
              <Shield className="w-5 h-5 text-primary" />
            ) : (
              <Key className="w-5 h-5 text-primary" />
            )}
          </div>
          <div>
            <h1 className="font-semibold text-foreground">TG Manager</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? 'Admin Panel' : 'User Access'}
            </p>
          </div>
        </div>
      </div>

      {codeUser && !isAdmin && (
        <div className="px-4 py-3 mx-4 mt-4 rounded-lg bg-muted/30 border border-border">
          <code className="text-sm font-mono font-bold text-foreground">
            {codeUser.accessCode}
          </code>
        </div>
      )}

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                isActive 
                  ? "bg-sidebar-accent text-primary" 
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
