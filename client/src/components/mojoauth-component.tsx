import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";

declare global {
  interface Window {
    MojoAuth: any;
  }
}

interface MojoAuthComponentProps {
  onSuccess?: () => void;
}

export function MojoAuthComponent({ onSuccess }: MojoAuthComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const mojoAuthRef = useRef<any>(null);
  const { refetchUser } = useAuth();

  useEffect(() => {
    // Load MojoAuth script
    const script = document.createElement('script');
    script.src = 'https://cdn.mojoauth.com/js/mojoauth.min.js';
    script.type = 'text/javascript';
    script.charset = 'UTF-8';
    script.onload = () => {
      setIsScriptLoaded(true);
      initializeMojoAuth();
    };
    script.onerror = () => {
      setError('Failed to load MojoAuth SDK');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  const initializeMojoAuth = async () => {
    try {
      if (window.MojoAuth) {
        // Get the API key from the server
        const configResponse = await fetch('/api/mojoauth/config');
        const config = await configResponse.json();
        
        if (!config.apiKey) {
          setError('MojoAuth API key not configured');
          return;
        }

        mojoAuthRef.current = new window.MojoAuth(config.apiKey, {
          language: "en",
          redirect_url: config.redirectUrl,
          source: [
            { type: "email", feature: "magiclink" },
            { type: "email", feature: "otp" }
          ]
        });
      }
    } catch (err) {
      console.error('Error initializing MojoAuth:', err);
      setError('Failed to initialize MojoAuth');
    }
  };

  const handlePasswordlessLogin = async () => {
    if (!mojoAuthRef.current) {
      setError('MojoAuth not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await mojoAuthRef.current.signIn();
      
      if (response.authenticated) {
        // Send the MojoAuth response to our backend for verification
        const verifyResponse = await fetch('/api/mojoauth/verify', {
          method: 'POST',
          body: JSON.stringify({
            access_token: response.oauth.access_token,
            user_id: response.user.user_id,
            identifier: response.user.identifier
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (verifyResponse.ok) {
          // Refetch user data to update the auth state
          await refetchUser();
          onSuccess?.();
        } else {
          const error = await verifyResponse.json();
          setError(error.message || 'Authentication failed');
        }
      }
    } catch (err) {
      console.error('MojoAuth error:', err);
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isScriptLoaded) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading passwordless authentication...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="font-semibold text-lg">Passwordless Sign In</h3>
          <p className="text-sm text-muted-foreground">
            Secure authentication without passwords using magic links or OTP
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div id="mojoauth-passwordless-form"></div>

        <Button
          onClick={handlePasswordlessLogin}
          className="w-full bg-blue-600 hover:bg-blue-700"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Authenticating...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Start Passwordless Login
            </>
          )}
        </Button>

        <div className="text-xs text-center text-muted-foreground">
          <p>You'll receive a magic link or OTP to complete sign in</p>
        </div>
      </CardContent>
    </Card>
  );
}