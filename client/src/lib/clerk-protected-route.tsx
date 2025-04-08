import { Redirect, Route } from "wouter";
import { useClerkIntegration } from "@/lib/clerk-client";
import { Loader2 } from "lucide-react";

type ProtectedRouteProps = {
  path: string;
  component: () => React.JSX.Element;
};

export function ClerkProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading } = useClerkIntegration();

  return (
    <Route path={path}>
      {(params) => {
        if (isLoading) {
          return (
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          );
        }

        if (!user) {
          return <Redirect to="/clerk-welcome" />;
        }

        // Component is guaranteed to return an Element (not null) because
        // we only get here if user is authenticated
        return <Component />;
      }}
    </Route>
  );
}