import { useAdminAuth } from "@/admin/hooks/use-admin-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route, RouteComponentProps } from "wouter";

interface AdminProtectedRouteProps {
  path: string;
  component: React.ComponentType<any>;
}

export function AdminProtectedRoute({ path, component: Component }: AdminProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        {(params) => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-border" />
          </div>
        )}
      </Route>
    );
  }

  if (!isAuthenticated) {
    return (
      <Route path={path}>
        {(params) => <Redirect to="/admin-login" />}
      </Route>
    );
  }

  return (
    <Route path={path}>
      {(params) => <Component {...params} />}
    </Route>
  );
}