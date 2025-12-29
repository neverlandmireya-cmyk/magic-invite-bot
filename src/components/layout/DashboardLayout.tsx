import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './Sidebar';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { loading, codeUser, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated at all
  if (!codeUser) {
    return <Navigate to="/auth" replace />;
  }

  // Code user trying to access non-links page
  if (!isAdmin && location.pathname !== '/links') {
    return <Navigate to="/links" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
