import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { adminQueryClient } from "./admin/lib/admin-query-client";
import { AdminToaster } from "./admin/components/admin-toaster";
import { AdminAuthProvider } from "./admin/hooks/use-admin-auth";
import { AdminProtectedRoute } from "./admin/lib/admin-protected-route";
import AdminLoginPage from "./admin/pages/login-page";
import AdminDashboardPage from "./admin/pages/dashboard-page";
import AdminNotFound from "./admin/pages/not-found";

export default function AdminApp() {
  return (
    <QueryClientProvider client={adminQueryClient}>
      <AdminAuthProvider>
        <Switch>
          <Route path="/admin-login" component={AdminLoginPage} />
          <AdminProtectedRoute path="/admin-dashboard" component={AdminDashboardPage} />
          <Route component={AdminNotFound} />
        </Switch>
      </AdminAuthProvider>
      <AdminToaster />
    </QueryClientProvider>
  );
}