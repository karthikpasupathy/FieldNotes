import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AdminToaster } from "@/components/admin-toaster";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { AdminProtectedRoute } from "./lib/admin-protected-route";
import AdminLoginPage from "@/pages/admin-login-page";
import AdminDashboardPage from "@/pages/admin-dashboard-page";
import NotFound from "@/pages/not-found";

export default function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <Switch>
          <Route path="/admin-login" component={AdminLoginPage} />
          <AdminProtectedRoute path="/admin-dashboard" component={AdminDashboardPage} />
          <Route component={NotFound} />
        </Switch>
      </AdminAuthProvider>
      <AdminToaster />
    </QueryClientProvider>
  );
}