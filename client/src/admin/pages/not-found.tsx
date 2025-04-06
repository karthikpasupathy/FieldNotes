import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">404</h1>
      <p className="text-xl mb-8">Admin page not found.</p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/admin-login">Go to Admin Login</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go to Main Site</Link>
        </Button>
      </div>
    </div>
  );
}