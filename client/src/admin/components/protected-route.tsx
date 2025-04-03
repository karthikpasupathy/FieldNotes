import { Redirect, Route, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "../hooks/use-admin-auth";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
}

export function ProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const [location] = useLocation();

  // Only render the actual route component when the path matches the current location
  const isActive = location === path;

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  if (!isAuthenticated) {
    return (
      <Route path={path}>
        <Redirect to="/admin-login" />
      </Route>
    );
  }

  return (
    <Route path={path}>
      {isActive && <Component />}
    </Route>
  );
}