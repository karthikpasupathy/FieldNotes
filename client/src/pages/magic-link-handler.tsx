import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type VerificationState = "loading" | "success" | "error";

export default function MagicLinkHandler() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const [verificationState, setVerificationState] = useState<VerificationState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Extract token from URL
    const pathParts = window.location.pathname.split('/');
    const token = pathParts[pathParts.length - 1];

    if (!token || token === 'magic-link') {
      setVerificationState("error");
      setErrorMessage("Invalid magic link");
      return;
    }

    // Verify the magic link
    const verifyMagicLink = async () => {
      try {
        const response = await fetch(`/api/magic-link-verify/${token}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (response.ok) {
          setVerificationState("success");
          // Redirect will be handled by the server, but we'll wait a moment
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } else {
          const data = await response.json();
          setVerificationState("error");
          setErrorMessage(data.message || "Failed to verify magic link");
        }
      } catch (error) {
        console.error('Magic link verification error:', error);
        setVerificationState("error");
        setErrorMessage("Network error. Please try again.");
      }
    };

    verifyMagicLink();
  }, []);

  // If user is already authenticated, redirect to home
  useEffect(() => {
    if (user && !authLoading && verificationState === "success") {
      navigate('/');
    }
  }, [user, authLoading, verificationState, navigate]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img src="/icons/daynotes-logo.png" alt="Daynotes Logo" className="h-16 w-16" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-8">
              Field Notes
            </h1>

            {verificationState === "loading" && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Verifying your magic link...
                </h2>
                <p className="text-gray-600">
                  Please wait while we log you in securely.
                </p>
              </div>
            )}

            {verificationState === "success" && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Login Successful!
                </h2>
                <p className="text-gray-600">
                  You have been successfully logged in. Redirecting to your dashboard...
                </p>
              </div>
            )}

            {verificationState === "error" && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Verification Failed
                </h2>
                <p className="text-gray-600">
                  {errorMessage}
                </p>
                <div className="mt-6">
                  <Button 
                    onClick={() => navigate('/auth')} 
                    className="btn-gradient"
                  >
                    Back to Login
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}