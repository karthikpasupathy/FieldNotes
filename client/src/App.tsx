import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import MojoAuthPage from "@/pages/mojoauth-page";
import ProfilePage from "@/pages/profile-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import MomentsPage from "@/pages/moments-page";
import IdeasPage from "@/pages/ideas-page";
import SearchPage from "@/pages/search-page";
import { ProtectedRoute } from "./lib/protected-route";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import InstallPrompt from "@/components/InstallPrompt";
import UpdateNotification from "@/components/UpdateNotification";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Component for the root route that redirects to proper location
function RootRedirect() {
  const today = new Date().toISOString().split('T')[0];
  const { user, isLoading } = useAuth();
  
  // While loading, show a loader
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // If user is logged in, redirect to today's page
  // If not, redirect to auth page
  return user ? <Redirect to={`/day/${today}`} /> : <Redirect to="/auth" />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UpdateNotification />
          <Switch>
            {/* Root redirect to current day */}
            <Route path="/">
              <RootRedirect />
            </Route>
            
            {/* Protected Routes */}
            <ProtectedRoute path="/day/:date" component={Home} />
            <ProtectedRoute path="/profile" component={ProfilePage} />
            <ProtectedRoute path="/moments" component={MomentsPage} />
            <ProtectedRoute path="/ideas" component={IdeasPage} />
            <ProtectedRoute path="/search" component={SearchPage} />
            
            {/* Public Routes */}
            <Route path="/auth" component={AuthPage} />
            <Route path="/mojoauth" component={MojoAuthPage} />
            <Route path="/reset-password" component={ResetPasswordPage} />
            
            {/* Fallback to 404 */}
            <Route component={NotFound} />
          </Switch>
          <InstallPrompt />
        </AuthProvider>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
