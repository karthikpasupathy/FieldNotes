import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient } from "@tanstack/react-query";

// Simple temporary page display
function AdminMessage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">Admin Section</h1>
      <p className="text-xl mb-8">This section is under maintenance. Please check back later.</p>
    </div>
  );
}

export default function AdminApp() {
  // Create a new QueryClient for the admin app
  const queryClient = new QueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <AdminMessage />
      <Toaster />
    </QueryClientProvider>
  );
}