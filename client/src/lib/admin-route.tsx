import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";
import NotFound from "@/pages/not-found";

interface AdminRouteProps {
  path: string;
  component: React.FC<any>;
}

export function AdminRoute({ path, component: Component }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // If logged in but not admin, show 404 (to hide the admin page existence)
  if (!user.isAdmin) {
    return (
      <Route path={path}>
        <NotFound />
      </Route>
    );
  }

  // User is admin, render the component
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}