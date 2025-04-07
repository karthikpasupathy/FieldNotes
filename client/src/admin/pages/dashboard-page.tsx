import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "@/admin/hooks/use-admin-auth";
import { getAdminQueryFn } from "@/admin/lib/admin-query-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { 
  Loader2, 
  Users, 
  FileText, 
  LogOut, 
  Mail,
  User,
  Calendar,
  Plus,
  X,
  Send,
  Brain
} from "lucide-react";
import { useLocation } from "wouter";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalNotes: number;
}

interface UserDetails {
  id: number;
  username: string;
  email: string;
  name: string | null;
}

interface ActiveUserDetails extends UserDetails {
  lastActive: string;
}

// UsersList component to display all users
function UsersList() {
  const { data: users, isLoading } = useQuery<UserDetails[]>({
    queryKey: ["/api/admin-users"],
    queryFn: getAdminQueryFn({ on401: "throw" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No users found.
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>List of all registered users</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium flex items-center">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              {user.username}
            </TableCell>
            <TableCell className="flex items-center">
              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
              {user.email}
            </TableCell>
            <TableCell>{user.name || '-'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ActiveUsersList component to display active users
function ActiveUsersList() {
  const { data: activeUsers, isLoading } = useQuery<ActiveUserDetails[]>({
    queryKey: ["/api/admin-active-users"],
    queryFn: getAdminQueryFn({ on401: "throw" }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!activeUsers || activeUsers.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No active users found in the last 30 days.
      </div>
    );
  }

  return (
    <Table>
      <TableCaption>Users active in the last 30 days</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Username</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Last Active</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activeUsers.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium flex items-center">
              <User className="h-4 w-4 mr-2 text-muted-foreground" />
              {user.username}
            </TableCell>
            <TableCell className="flex items-center">
              <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
              {user.email}
            </TableCell>
            <TableCell className="flex items-center">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              {new Date(user.lastActive).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();
  const { logout } = useAdminAuth();
  const [features, setFeatures] = useState<string[]>([""]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();
  
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin-stats"],
    queryFn: getAdminQueryFn({ on401: "throw" }),
  });

  const handleLogout = async () => {
    await logout();
    navigate("/admin-login");
  };
  
  const addFeature = () => {
    setFeatures([...features, ""]);
  };
  
  const removeFeature = (index: number) => {
    if (features.length > 1) {
      const newFeatures = [...features];
      newFeatures.splice(index, 1);
      setFeatures(newFeatures);
    }
  };
  
  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };
  
  const sendMarketingEmail = async () => {
    // Filter out empty features
    const nonEmptyFeatures = features.filter(feature => feature.trim() !== "");
    
    if (nonEmptyFeatures.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one feature to include in the email",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setSendingEmail(true);
      
      const response = await fetch("/api/admin-send-marketing", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ features: nonEmptyFeatures })
      });
      
      if (!response.ok) {
        throw new Error("Failed to send marketing email");
      }
      
      const result = await response.json();
      
      toast({
        title: "Success",
        description: result.message,
        variant: "default"
      });
      
      // Reset form
      setFeatures([""]);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred while sending email",
        variant: "destructive"
      });
    } finally {
      setSendingEmail(false);
    }
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
        <div className="flex items-center">
          <img src="/icons/daynotes-logo.png" alt="Daynotes Logo" className="h-10 w-10 mr-3" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      </div>
      
      {/* Marketing Email Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Marketing Email</CardTitle>
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <CardDescription>
            Send announcement emails to all registered users about new features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Features to Highlight:</h3>
              <p className="text-sm text-muted-foreground">
                Add bullet points for each feature to highlight in the email
              </p>
              
              {features.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                    placeholder="Enter a feature or announcement"
                    className="flex-1"
                  />
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeFeature(index)}
                    disabled={features.length <= 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={addFeature} 
                className="mt-2"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Feature
              </Button>
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={sendMarketingEmail} 
                disabled={sendingEmail || features.every(f => f.trim() === "")}
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to All Users
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="users">
        <TabsList className="mb-4">
          <TabsTrigger value="users">All Users</TabsTrigger>
          <TabsTrigger value="active">Active Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>
                Complete list of all registered users in the system.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersList />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Users</CardTitle>
              <CardDescription>
                Users who have been active in the last 30 days.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActiveUsersList />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}