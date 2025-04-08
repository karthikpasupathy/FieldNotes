import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import ResetPasswordPage from "@/pages/reset-password-page";
import MomentsPage from "@/pages/moments-page";
// Temporarily comment out Clerk imports to fix runtime errors in legacy mode
// import ClerkWelcomePage from "@/pages/clerk-welcome-page";
// import { ClerkApp, useClerkIntegration } from "@/lib/clerk-client";
// import { ClerkProtectedRoute } from "./lib/clerk-protected-route";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import InstallPrompt from "@/components/InstallPrompt";
import UpdateNotification from "@/components/UpdateNotification";
import { Loader2 } from "lucide-react";

// Component for the root route that redirects to proper location
function LegacyRootRedirect() {
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
  
  // If user is authenticated, redirect to today's page
  // If not, redirect to auth page
  return user ? <Redirect to={`/day/${today}`} /> : <Redirect to="/auth" />;
}

// Legacy app with session-based auth (for backward compatibility)
function LegacyApp() {
  return (
    <AuthProvider>
      <UpdateNotification />
      <Switch>
        {/* Root redirect to current day */}
        <Route path="/">
          <LegacyRootRedirect />
        </Route>
        
        {/* Legacy Public Routes */}
        <Route path="/auth" component={AuthPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        
        {/* Legacy Protected Routes */}
        <Route path="/day/:date">
          {() => {
            const { user } = useAuth();
            return user ? <Home /> : <Redirect to="/auth" />;
          }}
        </Route>
        <Route path="/profile">
          {() => {
            const { user } = useAuth();
            return user ? <ProfilePage /> : <Redirect to="/auth" />;
          }}
        </Route>
        <Route path="/moments">
          {() => {
            const { user } = useAuth();
            return user ? <MomentsPage /> : <Redirect to="/auth" />;
          }}
        </Route>
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
      <InstallPrompt />
    </AuthProvider>
  );
}

// Main app with Clerk auth - temporarily disabled since we're in legacy mode
// This function would be used when Clerk auth is enabled
function ClerkAppContent() {
  // We'll keep this as a stub/placeholder since we're not using Clerk right now
  return null;
}

function App() {
  // Detect the current authentication mode
  const authMode = import.meta.env.VITE_AUTH_MODE || 'clerk'; // Default to clerk
  const isLegacyMode = authMode === 'legacy';

  return (
    <QueryClientProvider client={queryClient}>
      {/* We're always using legacy mode for now until Clerk integration is fixed */}
      <LegacyApp />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
