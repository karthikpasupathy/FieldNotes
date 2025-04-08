import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClerkIntegration } from "@/lib/clerk-client";
import { ClerkAccountLinking } from "@/components/ClerkAccountLinking";
import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function ClerkWelcomePage() {
  const { isLoading, hasLinkedAccount, user, openSignIn, openSignUp } = useClerkIntegration();
  const [activeTab, setActiveTab] = useState<string>("welcome");
  const [, setLocation] = useLocation();

  // Once the user has linked their account, redirect them to the home page
  if (hasLinkedAccount && user) {
    setLocation('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Welcome to Daynotes</CardTitle>
          <CardDescription className="text-lg">
            Your personal daily journal with AI-powered insights
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="welcome">Welcome</TabsTrigger>
              <TabsTrigger value="link">Link Existing Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="welcome" className="mt-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">New to Daynotes?</h3>
                  <p className="text-muted-foreground">
                    Daynotes helps you capture your daily thoughts and discover insights over time.
                    With our AI-powered analysis, you'll gain unique perspectives on your notes.
                  </p>
                  <Button 
                    onClick={openSignUp} 
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Sign Up
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Already have a Clerk account?</h3>
                  <p className="text-muted-foreground">
                    If you already have an account through Clerk, you can sign in with
                    your existing credentials. You'll then be able to link to your Daynotes account.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={openSignIn}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Sign In
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-xl font-semibold mb-4">Why use Daynotes?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Daily Reflections</h4>
                    <p className="text-sm text-muted-foreground">
                      Quickly capture your thoughts in a structured daily format.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">AI Analysis</h4>
                    <p className="text-sm text-muted-foreground">
                      Get intelligent insights from weekly and monthly patterns.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Highlight Moments</h4>
                    <p className="text-sm text-muted-foreground">
                      Star special entries and analyze what makes them meaningful.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="link" className="mt-6">
              <ClerkAccountLinking onSuccess={() => setLocation('/')} />
            </TabsContent>
          </Tabs>
        </CardContent>
        
        <CardFooter className="flex justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Daynotes</span>
          <span>Powered by OpenAI</span>
        </CardFooter>
      </Card>
    </div>
  );
}