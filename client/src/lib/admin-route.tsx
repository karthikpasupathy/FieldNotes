import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

interface AdminRouteProps {
  path: string;
  component: React.FC<any>;
}

export function AdminRoute({ path, component: Component }: AdminRouteProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if the user has admin privileges
    async function checkAdminStatus() {
      try {
        // Try to fetch a simple admin endpoint
        const response = await fetch("/api/admin/users/count");
        
        if (response.ok) {
          setIsAdmin(true);
        } else {
          // If unauthorized, redirect to admin login
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminStatus();
  }, []);

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  // If not admin, redirect to admin login
  if (!isAdmin) {
    return (
      <Route path={path}>
        <Redirect to="/admin-login" />
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