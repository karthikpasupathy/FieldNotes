import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  setEncryptionKey, 
  clearEncryptionKey, 
  generateNewUserSalt, 
  isEncryptionEnabled 
} from "@/lib/encryption";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<User, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, InsertUser>;
  resetPasswordRequestMutation: UseMutationResult<void, Error, { email: string }>;
  resetPasswordMutation: UseMutationResult<void, Error, { token: string; password: string }>;
  
  // Encryption-related methods
  isEncryptionAvailable: boolean;
  enableEncryptionMutation: UseMutationResult<User, Error, void>;
  disableEncryptionMutation: UseMutationResult<User, Error, { confirmPassword: string }>;
};

type LoginData = {
  username: string;
  password: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<User | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      // Save credentials for encryption key setup
      const user = await res.json();
      
      // Set up encryption if the user has it enabled
      if (user.encryptionEnabled && user.encryptionSalt) {
        setEncryptionKey(credentials.password, user.encryptionSalt);
        
        // Log additional information if encryption was set up
        if (isEncryptionEnabled()) {
          console.log('End-to-end encryption initialized for this session');
        }
      }
      
      return user;
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (userData: InsertUser) => {
      // Generate an encryption salt for all new users
      // This allows them to enable encryption later without changing password
      const encryptionSalt = generateNewUserSalt();
      
      // Add the salt to the registration data
      const userDataWithSalt = {
        ...userData,
        encryptionSalt,
        encryptionEnabled: false, // Default to disabled
        encryptionVersion: 'v1',
      };
      
      const res = await apiRequest("POST", "/api/register", userDataWithSalt);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.name || user.username}!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message || "Username or email may already be in use",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      // Clear the encryption key when logging out
      clearEncryptionKey();
      
      // Clear user data from cache
      queryClient.setQueryData(["/api/user"], null);
      
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutation to enable encryption for the current user
  const enableEncryptionMutation = useMutation({
    mutationFn: async () => {
      // This requires the current password which we already have from login
      const result = await apiRequest("POST", "/api/user/enable-encryption");
      return await result.json();
    },
    onSuccess: (updatedUser: User) => {
      // Update user data in cache
      queryClient.setQueryData(["/api/user"], updatedUser);
      
      toast({
        title: "Encryption Enabled",
        description: "Your notes are now protected with end-to-end encryption. Only you can read them.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't Enable Encryption",
        description: error.message || "There was a problem enabling encryption",
        variant: "destructive",
      });
    },
  });
  
  // Mutation to disable encryption (requires password confirmation)
  const disableEncryptionMutation = useMutation({
    mutationFn: async ({ confirmPassword }: { confirmPassword: string }) => {
      const result = await apiRequest("POST", "/api/user/disable-encryption", { 
        password: confirmPassword 
      });
      return await result.json();
    },
    onSuccess: (updatedUser: User) => {
      // Update user data in cache
      queryClient.setQueryData(["/api/user"], updatedUser);
      
      // Clear the encryption key
      clearEncryptionKey();
      
      toast({
        title: "Encryption Disabled",
        description: "End-to-end encryption has been turned off for your account.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't Disable Encryption",
        description: error.message || "There was a problem disabling encryption. Check your password.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordRequestMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      await apiRequest("POST", "/api/reset-password-request", { email });
    },
    onSuccess: () => {
      toast({
        title: "Reset email sent",
        description: "Check your email for the password reset token",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send reset email",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      await apiRequest("POST", "/api/reset-password", { token, password });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Password reset successful",
        description: "Your password has been updated. You can now log in with your new password.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Password reset failed",
        description: error.message || "Invalid or expired token",
        variant: "destructive",
      });
    },
  });

  // Check if the browser supports the encryption features we need
  const isEncryptionAvailable = typeof window !== 'undefined' && 
                               window.crypto && 
                               window.crypto.subtle && 
                               typeof TextEncoder !== 'undefined';
                               
  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
        resetPasswordRequestMutation,
        resetPasswordMutation,
        
        // Encryption related properties and methods
        isEncryptionAvailable,
        enableEncryptionMutation,
        disableEncryptionMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}