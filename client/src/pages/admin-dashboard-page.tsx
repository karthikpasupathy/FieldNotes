import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, Users, BookText, Brain, UserCheck, LogOut } from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalNotes: number;
  totalAnalyses: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { logout, isAuthenticated } = useAdminAuth();

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const response = await fetch("/api/admin-stats", {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch admin statistics");
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStats();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Daynotes Admin Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Users" 
          value={stats?.totalUsers ?? 0} 
          description="Total registered accounts" 
          icon={<Users className="h-5 w-5 text-blue-500" />} 
          color="bg-blue-50 dark:bg-blue-950"
        />
        
        <StatCard 
          title="Active Users" 
          value={stats?.activeUsers ?? 0} 
          description="Active in last 14 days" 
          icon={<UserCheck className="h-5 w-5 text-green-500" />} 
          color="bg-green-50 dark:bg-green-950"
        />
        
        <StatCard 
          title="Total Notes" 
          value={stats?.totalNotes ?? 0} 
          description="Entries created by users" 
          icon={<BookText className="h-5 w-5 text-amber-500" />} 
          color="bg-amber-50 dark:bg-amber-950"
        />
        
        <StatCard 
          title="AI Analyses" 
          value={stats?.totalAnalyses ?? 0} 
          description="AI-generated insights" 
          icon={<Brain className="h-5 w-5 text-purple-500" />} 
          color="bg-purple-50 dark:bg-purple-950"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, description, icon, color }: StatCardProps) {
  return (
    <Card className={`${color} border-none shadow-md`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          {icon}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}