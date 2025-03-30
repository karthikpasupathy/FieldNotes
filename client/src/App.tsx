import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import AdminDashboard from "@/pages/admin-dashboard";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider } from "@/hooks/use-auth";

function Router() {
  return (
    <Switch>
      {/* Protected Routes */}
      <ProtectedRoute path="/" component={Home} />
      <ProtectedRoute path="/day/:date" component={Home} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/admin" component={AdminDashboard} />
      
      {/* Public Routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
