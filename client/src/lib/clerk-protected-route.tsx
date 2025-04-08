import { useClerkIntegration } from '@/lib/clerk-client';
import { Loader2 } from 'lucide-react';
import { Redirect, Route } from 'wouter';

type ProtectedRouteProps = {
  path: string;
  component: () => React.JSX.Element;
};

export function ClerkProtectedRoute({ path, component: Component }: ProtectedRouteProps) {
  const { user, isLoading } = useClerkIntegration();

  return (
    <Route
      path={path}
      component={() => {
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

        return <Component />;
      }}
    />
  );
}