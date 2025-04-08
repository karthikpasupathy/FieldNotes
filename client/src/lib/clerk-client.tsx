import { Clerk } from '@clerk/clerk-js';
import type { UserResource } from '@clerk/types';
import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './queryClient';
import { User } from '@shared/schema';

// Initialize Clerk with our publishable key
let clerk: Clerk | null = null;

// Get singleton Clerk instance
function getClerk() {
  if (!clerk) {
    clerk = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
    clerk.load({
      appearance: {
        variables: {
          colorPrimary: '#3b4e87',
          colorBackground: '#eaf0f9',
          colorText: '#3b4e87',
          colorTextOnPrimaryBackground: 'white',
          colorSuccess: '#ffc53d',
        }
      }
    });
  }
  return clerk;
}

// Custom hook to access Clerk auth state
function useClerkAuth() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<UserResource | null>(null);

  useEffect(() => {
    const clerk = getClerk();

    const unsubscribe = clerk.addListener((event) => {
      if (event === 'load') {
        setIsLoaded(true);
        setIsSignedIn(!!clerk.user);
        setUserId(clerk.user?.id || null);
        setUser(clerk.user);
      }
      if (event === 'signIn') {
        setIsSignedIn(true);
        setUserId(clerk.user?.id || null);
        setUser(clerk.user);
      }
      if (event === 'signOut') {
        setIsSignedIn(false);
        setUserId(null);
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isLoaded, isSignedIn, userId, user };
}

// Custom context for our integration between Clerk and our database
interface ClerkIntegrationContext {
  user: User | null;
  isLoading: boolean;
  hasLinkedAccount: boolean;
  clerkUser: UserResource | null;
  linkExistingAccount: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  openSignIn: () => void;
  openSignUp: () => void;
}

const ClerkIntegrationContext = createContext<ClerkIntegrationContext | undefined>(undefined);

export function DaynotesClerkProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLinkedAccount, setHasLinkedAccount] = useState(false);
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn, userId, user: clerkUser } = useClerkAuth();

  // Load user data from our database when clerk auth state changes
  useEffect(() => {
    if (!isLoaded) return;

    async function loadUserData() {
      setIsLoading(true);
      
      if (isSignedIn && userId) {
        try {
          const response = await apiRequest('GET', '/api/clerk/user');
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setHasLinkedAccount(true);
            
            // Refresh all queries that might depend on auth state
            queryClient.invalidateQueries();
          } else if (response.status === 404) {
            // User exists in Clerk but not in our database
            setUser(null);
            setHasLinkedAccount(false);
          }
        } catch (error) {
          console.error('Failed to load user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        setHasLinkedAccount(false);
      }
      
      setIsLoading(false);
    }

    loadUserData();
  }, [isLoaded, isSignedIn, userId, queryClient]);

  // Function to link a Clerk account with an existing Daynotes account
  const linkExistingAccount = async (username: string, password: string) => {
    if (!isSignedIn || !userId) {
      throw new Error('You must be signed in with Clerk to link an account');
    }

    const response = await apiRequest('POST', '/api/clerk/link-account', {
      username,
      password,
      clerkUserId: userId
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to link account');
    }

    const userData = await response.json();
    setUser(userData);
    setHasLinkedAccount(true);
    
    // Refresh all queries that might depend on auth state
    queryClient.invalidateQueries();
  };

  // Sign out from Clerk
  const signOut = async () => {
    const clerk = getClerk();
    await clerk.signOut();
  };

  // Open Clerk sign in modal
  const openSignIn = () => {
    const clerk = getClerk();
    clerk.openSignIn();
  };

  // Open Clerk sign up modal
  const openSignUp = () => {
    const clerk = getClerk();
    clerk.openSignUp();
  };

  const value = {
    user,
    isLoading: isLoading || !isLoaded,
    hasLinkedAccount,
    clerkUser,
    linkExistingAccount,
    signOut,
    openSignIn,
    openSignUp
  };

  return (
    <ClerkIntegrationContext.Provider value={value}>
      {children}
    </ClerkIntegrationContext.Provider>
  );
}

export function ClerkApp({ children }: { children: ReactNode }) {
  // Initialize Clerk on mount
  useEffect(() => {
    getClerk();
  }, []);

  return (
    <DaynotesClerkProvider>
      {children}
    </DaynotesClerkProvider>
  );
}

export function useClerkIntegration() {
  const context = useContext(ClerkIntegrationContext);
  if (context === undefined) {
    throw new Error('useClerkIntegration must be used within a DaynotesClerkProvider');
  }
  return context;
}