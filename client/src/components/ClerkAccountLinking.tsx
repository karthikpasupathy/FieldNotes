import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useClerkIntegration } from "@/lib/clerk-client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Form schema for account linking
const linkAccountSchema = z.object({
  username: z.string().min(3, {
    message: "Username must be at least 3 characters."
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters."
  }),
});

type LinkAccountFormValues = z.infer<typeof linkAccountSchema>;

export function ClerkAccountLinking({ onSuccess }: { onSuccess?: () => void }) {
  const { linkExistingAccount, isLoading: isAuthLoading, clerkUser } = useClerkIntegration();
  const [error, setError] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);

  // Initialize form with react-hook-form
  const form = useForm<LinkAccountFormValues>({
    resolver: zodResolver(linkAccountSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Handle form submission
  const onSubmit = async (values: LinkAccountFormValues) => {
    try {
      setError(null);
      setIsLinking(true);
      
      await linkExistingAccount(values.username, values.password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link account. Please check your credentials.");
    } finally {
      setIsLinking(false);
    }
  };

  const isLoading = isAuthLoading || isLinking;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Link Your Existing Account</h3>
        <p className="text-muted-foreground">
          Connect your Clerk account ({clerkUser?.primaryEmailAddress?.emailAddress}) with your existing Daynotes account.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input disabled={isLoading} placeholder="Your Daynotes username" {...field} />
                </FormControl>
                <FormDescription>
                  Enter the username you used with your existing Daynotes account.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    disabled={isLoading}
                    placeholder="Your Daynotes password" 
                    {...field} 
                  />
                </FormControl>
                <FormDescription>
                  Enter the password for your existing Daynotes account.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Link Account
          </Button>
        </form>
      </Form>
    </div>
  );
}