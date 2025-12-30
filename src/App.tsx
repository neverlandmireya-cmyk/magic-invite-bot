import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Links from "./pages/Links";
import AdminCodes from "./pages/AdminCodes";
import Support from "./pages/Support";
import ActivityLogs from "./pages/ActivityLogs";
import Resellers from "./pages/Resellers";
import ResellerDashboard from "./pages/ResellerDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthRedirect() {
  const { loading, codeUser, isAdmin, isReseller } = useAuth();
  
  if (loading) return null;
  if (codeUser) {
    if (isAdmin) return <Navigate to="/" replace />;
    if (isReseller) return <Navigate to="/reseller" replace />;
    return <Navigate to="/links" replace />;
  }
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRedirect />} />
            <Route element={<DashboardLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/links" element={<Links />} />
              <Route path="/admin-codes" element={<AdminCodes />} />
              <Route path="/support" element={<Support />} />
              <Route path="/activity" element={<ActivityLogs />} />
              <Route path="/resellers" element={<Resellers />} />
              <Route path="/reseller" element={<ResellerDashboard />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;