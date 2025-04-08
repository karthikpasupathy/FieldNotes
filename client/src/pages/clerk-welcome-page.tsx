import { useState } from "react";
import { useClerkIntegration } from "@/lib/clerk-client";
import { Button } from "@/components/ui/button";
import { Link, Redirect } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClerkAccountLinking } from "@/components/ClerkAccountLinking";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export default function ClerkWelcomePage() {
  const { user, isLoading, hasLinkedAccount, openSignIn, openSignUp } = useClerkIntegration();
  const [activeTab, setActiveTab] = useState<string>("existing");

  // If user is already authenticated and linked to a database user, redirect to home
  if (!isLoading && user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Welcome content */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">
            Welcome to Daynotes
          </h1>
          <p className="text-lg text-slate-600 mb-6">
            Your daily journaling app with AI-powered insights
          </p>
          <div className="space-y-4 text-slate-700">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <span className="text-primary text-xl">✓</span>
              </div>
              <div>
                <h3 className="font-medium">Daily entries</h3>
                <p className="text-sm text-slate-500">
                  Capture your thoughts in bite-sized notes, organized by day
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <span className="text-primary text-xl">✓</span>
              </div>
              <div>
                <h3 className="font-medium">AI Analysis</h3>
                <p className="text-sm text-slate-500">
                  Get insights about your mood, mindset, and patterns
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-full">
                <span className="text-primary text-xl">✓</span>
              </div>
              <div>
                <h3 className="font-medium">Track special moments</h3>
                <p className="text-sm text-slate-500">
                  Mark important entries and discover patterns
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Authentication card */}
        <div>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Sign in with Clerk</CardTitle>
              <CardDescription>
                We've integrated with Clerk for secure, modern authentication
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : hasLinkedAccount ? (
                <div className="text-center py-4">
                  <p className="mb-4 text-green-600">
                    Your account is successfully linked!
                  </p>
                  <Link href="/">
                    <Button size="lg">Go to Dashboard</Button>
                  </Link>
                </div>
              ) : (
                <Tabs
                  defaultValue="existing"
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="existing">Existing User</TabsTrigger>
                    <TabsTrigger value="new">New User</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-4">
                    <div className="space-y-4">
                      <p className="text-sm text-slate-600">
                        Already have a Daynotes account? Link it with Clerk to
                        continue using your existing data.
                      </p>
                      <ClerkAccountLinking />
                    </div>
                  </TabsContent>

                  <TabsContent value="new" className="space-y-4">
                    <p className="text-sm text-slate-600">
                      New to Daynotes? Create a new account with Clerk's secure
                      authentication.
                    </p>
                    <div className="flex flex-col gap-4">
                      <Button
                        size="lg"
                        variant="default"
                        onClick={openSignUp}
                        className="w-full"
                      >
                        Create Account
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={openSignIn}
                        className="w-full"
                      >
                        Sign In
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-6">
              <p className="text-xs text-slate-500 text-center">
                By signing in, you agree to our Terms of Service and Privacy
                Policy. Your data is stored securely and you can export or delete
                it anytime.
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}