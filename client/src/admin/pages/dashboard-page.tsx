import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/admin/hooks/use-admin-auth";
import { getAdminQueryFn } from "@/admin/lib/admin-query-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Users, FileText, BarChart2, LogOut } from "lucide-react";
import { useLocation } from "wouter";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalNotes: number;
  totalAnalyses: number;
}

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { logout } = useAdminAuth();
  
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin-stats"],
    queryFn: getAdminQueryFn({ on401: "throw" }),
  });

  const handleLogout = async () => {
    await logout();
    navigate("/admin-login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary" />
              {stats?.totalUsers || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Users (Last 30 days)</CardDescription>
            <CardTitle className="text-3xl flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary" />
              {stats?.activeUsers || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Notes</CardDescription>
            <CardTitle className="text-3xl flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary" />
              {stats?.totalNotes || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Analyses</CardDescription>
            <CardTitle className="text-3xl flex items-center">
              <BarChart2 className="h-5 w-5 mr-2 text-primary" />
              {stats?.totalAnalyses || 0}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
      
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="analyses">Analyses</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Statistics</CardTitle>
              <CardDescription>
                Detailed information about user registration and activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground">
                Detailed statistics will be added in a future update.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notes">
          <Card>
            <CardHeader>
              <CardTitle>Notes Statistics</CardTitle>
              <CardDescription>
                Detailed information about notes creation and trends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground">
                Detailed statistics will be added in a future update.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analyses">
          <Card>
            <CardHeader>
              <CardTitle>Analyses Statistics</CardTitle>
              <CardDescription>
                Detailed information about AI analyses usage.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-8 text-center text-muted-foreground">
                Detailed statistics will be added in a future update.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}