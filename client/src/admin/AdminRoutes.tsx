import { Switch, Route } from "wouter";
import { AdminToaster } from "./components/admin-toaster";
import { AdminAuthProvider } from "./hooks/use-admin-auth";
import { AdminToastProvider } from "./hooks/use-admin-toast";
import { AdminProtectedRoute } from "./lib/admin-protected-route";
import AdminLoginPage from "./pages/login-page";
import AdminDashboardPage from "./pages/dashboard-page";
import AdminNotFound from "./pages/not-found";

export function AdminApp() {
  return (
    <AdminToastProvider>
      <AdminAuthProvider>
        <Switch>
          <Route path="/admin-login" component={AdminLoginPage} />
          <AdminProtectedRoute path="/admin-dashboard" component={AdminDashboardPage} />
          <Route component={AdminNotFound} />
        </Switch>
        <AdminToaster />
      </AdminAuthProvider>
    </AdminToastProvider>
  );
}