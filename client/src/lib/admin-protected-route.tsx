import { Redirect, Route, RouteComponentProps } from "wouter";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";

interface AdminProtectedRouteProps {
  path: string;
  component: React.ComponentType;
}

export function AdminProtectedRoute({ path, component: Component }: AdminProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
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

  // Render the component inside the Route instead of using the component prop
  return (
    <Route path={path}>
      {(params) => <Component {...params} />}
    </Route>
  );
}