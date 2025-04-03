import { createContext, ReactNode, useContext, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { adminApiRequest, getAdminQueryFn, adminQueryClient } from "../lib/admin-query-client";
import { useToast } from "@/hooks/use-toast";

type AdminAuthContextType = {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const {
    data: isAuthenticated,
    isLoading,
  } = useQuery<boolean>({
    queryKey: ["/api/admin-auth-check"],
    queryFn: getAdminQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await adminApiRequest("POST", "/api/admin-login", credentials);
      return res.ok;
    },
    onSuccess: () => {
      adminQueryClient.setQueryData(["/api/admin-auth-check"], true);
      setError(null);
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await adminApiRequest("POST", "/api/admin-logout");
    },
    onSuccess: () => {
      adminQueryClient.setQueryData(["/api/admin-auth-check"], false);
      setError(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const login = async (username: string, password: string) => {
    await loginMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated: !!isAuthenticated,
        isLoading,
        error,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
}