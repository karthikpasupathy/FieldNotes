import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Mail, Phone, Key } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface MojoAuthResponse {
  success?: boolean;
  stateId?: string;
  message?: string;
  authenticated?: boolean;
  user?: any;
  token?: string;
  error?: string;
}

export default function MojoAuthPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [stateId, setStateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"send" | "verify">("send");
  const [authMethod, setAuthMethod] = useState<"magiclink" | "email-otp" | "phone-otp">("email-otp");
  const { toast } = useToast();

  const handleSendMagicLink = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/mojoauth/magic-link/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email,
          redirectUrl: window.location.origin + "/dashboard"
        }),
      });

      const data: MojoAuthResponse = await response.json();

      if (data.success && data.stateId) {
        setStateId(data.stateId);
        setStep("verify");
        toast({
          title: "Magic Link Sent",
          description: data.message || "Check your email for the magic link",
        });
        
        // Start polling for magic link status
        pollMagicLinkStatus(data.stateId);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send magic link",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const pollMagicLinkStatus = async (stateId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch("/api/auth/mojoauth/magic-link/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stateId }),
        });

        const data: MojoAuthResponse = await response.json();

        if (data.authenticated) {
          clearInterval(pollInterval);
          toast({
            title: "Success",
            description: "Successfully authenticated! Redirecting...",
          });
          
          // Redirect to home page
          setTimeout(() => {
            window.location.href = "/";
          }, 1000);
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000); // Poll every 2 seconds

    // Stop polling after 5 minutes
    setTimeout(() => clearInterval(pollInterval), 300000);
  };

  const handleSendEmailOTP = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/mojoauth/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data: MojoAuthResponse = await response.json();

      if (data.success && data.stateId) {
        setStateId(data.stateId);
        setStep("verify");
        toast({
          title: "OTP Sent",
          description: data.message || "Check your email for the OTP code",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send OTP",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneOTP = async () => {
    if (!phone) {
      toast({
        title: "Error",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/mojoauth/phone-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data: MojoAuthResponse = await response.json();

      if (data.success && data.stateId) {
        setStateId(data.stateId);
        setStep("verify");
        toast({
          title: "OTP Sent",
          description: data.message || "Check your phone for the OTP code",
        });
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to send OTP",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || !stateId) {
      toast({
        title: "Error",
        description: "Please enter the OTP code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = authMethod === "email-otp" 
        ? "/api/auth/mojoauth/email-otp/verify"
        : "/api/auth/mojoauth/phone-otp/verify";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp, stateId }),
        credentials: 'include', // Include cookies in request
      });

      const data: MojoAuthResponse = await response.json();

      if (data.success) {
        toast({
          title: "Success",
          description: "Successfully authenticated! Redirecting...",
        });
        
        // Wait a bit for session to be fully established
        setTimeout(async () => {
          // Invalidate queries to refresh auth state
          await queryClient.invalidateQueries({ queryKey: ['/api/user'] });
          
          // Redirect to home page
          window.location.href = "/";
        }, 500);
      } else {
        toast({
          title: "Error",
          description: data.error || "Invalid OTP code",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("send");
    setStateId("");
    setOtp("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Sign in to Field Notes
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Choose your preferred passwordless authentication method
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Passwordless Authentication</CardTitle>
            <CardDescription>
              No passwords required. We'll send you a secure link or code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "send" ? (
              <Tabs value={authMethod} onValueChange={(value: any) => setAuthMethod(value)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="email-otp">
                    <Mail className="w-4 h-4 mr-1" />
                    Email OTP
                  </TabsTrigger>
                  <TabsTrigger value="magiclink">
                    <Mail className="w-4 h-4 mr-1" />
                    Magic Link
                  </TabsTrigger>
                  <TabsTrigger value="phone-otp">
                    <Phone className="w-4 h-4 mr-1" />
                    Phone OTP
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="email-otp" className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <Button 
                    onClick={handleSendEmailOTP} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Sending..." : "Send OTP to Email"}
                  </Button>
                </TabsContent>

                <TabsContent value="magiclink" className="space-y-4">
                  <div>
                    <Label htmlFor="email-magic">Email Address</Label>
                    <Input
                      id="email-magic"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <Button 
                    onClick={handleSendMagicLink} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Sending..." : "Send Magic Link"}
                  </Button>
                </TabsContent>

                <TabsContent value="phone-otp" className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1234567890"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Include country code (e.g., +1 for US)
                    </p>
                  </div>
                  <Button 
                    onClick={handleSendPhoneOTP} 
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Sending..." : "Send OTP to Phone"}
                  </Button>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-4">
                {authMethod === "magiclink" ? (
                  <div className="text-center space-y-4">
                    <div className="animate-pulse">
                      <Mail className="w-16 h-16 mx-auto text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Check Your Email</h3>
                      <p className="text-sm text-gray-600">
                        We've sent a magic link to <strong>{email}</strong>
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        Click the link in your email to sign in automatically.
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleBack}>
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter 6-digit code"
                      maxLength={6}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Check your {authMethod === "email-otp" ? "email" : "phone"} for the 6-digit code
                    </p>
                    <div className="flex space-x-2 mt-4">
                      <Button 
                        onClick={handleVerifyOTP} 
                        disabled={loading}
                        className="flex-1"
                      >
                        {loading ? "Verifying..." : "Verify Code"}
                      </Button>
                      <Button variant="outline" onClick={handleBack}>
                        Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 text-center">
              <Link href="/auth">
                <Button variant="link" className="text-sm">
                  Use traditional login instead
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}