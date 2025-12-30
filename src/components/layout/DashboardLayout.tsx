import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Sidebar } from './Sidebar';
import { Loader2 } from 'lucide-react';

export function DashboardLayout() {
  const { loading, codeUser, isAdmin, isReseller } = useAuth();
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

  // Define allowed paths based on user role
  const resellerAllowedPaths = ['/reseller', '/links', '/activity', '/support'];
  const userAllowedPaths = ['/links', '/support'];

  // Reseller trying to access paths they shouldn't
  if (isReseller && !resellerAllowedPaths.includes(location.pathname)) {
    return <Navigate to="/reseller" replace />;
  }

  // Regular user trying to access admin/reseller pages
  if (!isAdmin && !isReseller && !userAllowedPaths.includes(location.pathname)) {
    return <Navigate to="/links" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
