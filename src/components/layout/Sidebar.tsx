import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Link2, Settings, LogOut, LayoutDashboard, Shield, Key, UserCog, HelpCircle, Menu, Activity, Users } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const adminNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/links", label: "Invite Links", icon: Link2 },
  { path: "/activity", label: "Activity Logs", icon: Activity },
  { path: "/resellers", label: "Resellers", icon: Users },
  { path: "/admin-codes", label: "Admin Access", icon: UserCog },
  { path: "/support", label: "Ticket", icon: HelpCircle },
  { path: "/settings", label: "Settings", icon: Settings },
];

const resellerNavItems = [
  { path: "/reseller", label: "Dashboard", icon: LayoutDashboard },
  { path: "/links", label: "Invite Links", icon: Link2 },
  { path: "/activity", label: "Activity Logs", icon: Activity },
  { path: "/support", label: "Ticket", icon: HelpCircle },
];

const userNavItems = [
  { path: "/links", label: "My Invite", icon: Link2 },
  { path: "/support", label: "Ticket", icon: HelpCircle },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut, isAdmin, isReseller, codeUser } = useAuth();

  const navItems = isAdmin ? adminNavItems : isReseller ? resellerNavItems : userNavItems;

  return (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logo} alt="EXYLUS.NET" className="w-10 h-10 rounded-xl object-contain" />
          <div>
            <h1 className="font-semibold text-foreground">EXYLUS.NET</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Admin Panel" : isReseller ? "Reseller Panel" : "User Access"}
            </p>
          </div>
        </div>
      </div>

      {codeUser && !isAdmin && (
        <div className="px-4 py-3 mx-4 mt-4 rounded-lg bg-muted/30 border border-border">
          <code className="text-sm font-mono font-bold text-foreground">{codeUser.accessCode}</code>
          {isReseller && codeUser.credits !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">{codeUser.credits} credits</p>
          )}
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
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
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
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const { isReseller } = useAuth();

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-sidebar-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="EXYLUS.NET" className="w-8 h-8 rounded-lg object-contain" />
          <h1 className="font-semibold text-foreground">EXYLUS.NET</h1>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <div className="h-full flex flex-col">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 h-screen bg-sidebar border-r border-sidebar-border flex-col sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
}