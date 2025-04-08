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
// Clerk imports are now ready
import ClerkWelcomePage from "@/pages/clerk-welcome-page";
import { ClerkApp, useClerkIntegration } from "@/lib/clerk-client";
import { ClerkProtectedRoute } from "./lib/clerk-protected-route";
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
            // Make sure we always return a valid JSX element, never null
            if (user) {
              return <Home />;
            } else {
              return <Redirect to="/auth" />;
            }
          }}
        </Route>
        <Route path="/profile">
          {() => {
            const { user } = useAuth();
            // Make sure we always return a valid JSX element, never null
            if (user) {
              return <ProfilePage />;
            } else {
              return <Redirect to="/auth" />;
            }
          }}
        </Route>
        <Route path="/moments">
          {() => {
            const { user } = useAuth();
            // Make sure we always return a valid JSX element, never null
            if (user) {
              return <MomentsPage />;
            } else {
              return <Redirect to="/auth" />;
            }
          }}
        </Route>
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
      <InstallPrompt />
    </AuthProvider>
  );
}

// Main app with Clerk auth 
function ClerkAppContent() {
  const today = new Date().toISOString().split('T')[0];
  const { user, isLoading } = useClerkIntegration();
  
  return (
    <>
      <UpdateNotification />
      <Switch>
        {/* Root redirect to current day or welcome page */}
        <Route path="/">
          {() => {
            if (isLoading) {
              return (
                <div className="flex items-center justify-center min-h-screen">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              );
            }
            // Make sure we always return a valid JSX element, never null
            if (user) {
              return <Redirect to={`/day/${today}`} />;
            } else {
              return <Redirect to="/clerk-welcome" />;
            }
          }}
        </Route>
        
        {/* Clerk Public Routes */}
        <Route path="/clerk-welcome" component={ClerkWelcomePage} />
        
        {/* Clerk Protected Routes */}
        <ClerkProtectedRoute path="/day/:date" component={Home} />
        <ClerkProtectedRoute path="/profile" component={ProfilePage} />
        <ClerkProtectedRoute path="/moments" component={MomentsPage} />
        
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
      <InstallPrompt />
    </>
  );
}

function App() {
  // Detect the current authentication mode
  const authMode = import.meta.env.VITE_AUTH_MODE || 'clerk'; // Default to clerk
  const isLegacyMode = authMode === 'legacy';

  return (
    <QueryClientProvider client={queryClient}>
      {isLegacyMode ? (
        // Legacy mode with session-based auth
        <LegacyApp />
      ) : (
        // Clerk auth mode
        <ClerkApp>
          <ClerkAppContent />
        </ClerkApp>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
