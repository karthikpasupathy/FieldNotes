import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAdminAuth } from "@/admin/hooks/use-admin-auth";
import { getAdminQueryFn, adminApiRequest, adminQueryClient } from "@/admin/lib/admin-query-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2, 
  Users, 
  FileText, 
  LogOut, 
  Mail,
  User,
  Calendar,
  Download,
  Trash2
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
  const { toast } = useToast();
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: users, isLoading } = useQuery<UserDetails[]>({
    queryKey: ["/api/admin-users"],
    queryFn: getAdminQueryFn({ on401: "throw" }),
  });

  // Mutation for exporting user data
  const exportUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await adminApiRequest("GET", `/api/admin/user/${userId}/export`);
      return await response.json();
    },
    onSuccess: (data) => {
      // Generate filename based on username and date
      const filename = `${data.user.username}_export_${new Date().toISOString().split('T')[0]}.json`;
      
      // Create a downloadable JSON file
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: `Data for ${data.user.username} has been exported.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export user data",
        variant: "destructive",
      });
    }
  });
  
  // Mutation for deleting a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await adminApiRequest("DELETE", `/api/admin/user/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user account has been permanently deleted.",
      });
      
      // Invalidate queries to refresh the data
      adminQueryClient.invalidateQueries({ queryKey: ["/api/admin-users"] });
      adminQueryClient.invalidateQueries({ queryKey: ["/api/admin-stats"] });
      adminQueryClient.invalidateQueries({ queryKey: ["/api/admin-active-users"] });
      
      // Reset state
      setDeletingUserId(null);
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
      setDeletingUserId(null);
      setIsDialogOpen(false);
    }
  });
  
  const handleExportUser = (userId: number) => {
    exportUserMutation.mutate(userId);
  };
  
  const confirmDeleteUser = (userId: number) => {
    setDeletingUserId(userId);
    setIsDialogOpen(true);
  };
  
  const handleDeleteUser = () => {
    if (deletingUserId) {
      deleteUserMutation.mutate(deletingUserId);
    }
  };
  
  const cancelDelete = () => {
    setDeletingUserId(null);
    setIsDialogOpen(false);
  };

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
    <>
      <Table>
        <TableCaption>List of all registered users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleExportUser(user.id)}
                    disabled={exportUserMutation.isPending}
                  >
                    {exportUserMutation.isPending && exportUserMutation.variables === user.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Export
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => confirmDeleteUser(user.id)}
                    disabled={deleteUserMutation.isPending}
                  >
                    {deleteUserMutation.isPending && deletingUserId === user.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user's account
              and all associated notes, moments, and analyses.
              
              <div className="mt-4 bg-amber-50 dark:bg-amber-950 p-3 rounded border border-amber-200 dark:border-amber-800">
                <p className="font-medium">Recommendation:</p>
                <p className="text-sm mt-1">Export the user's data before deletion by clicking the "Export" button.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ActiveUsersList component to display active users
function ActiveUsersList() {
  const { toast } = useToast();
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data: activeUsers, isLoading } = useQuery<ActiveUserDetails[]>({
    queryKey: ["/api/admin-active-users"],
    queryFn: getAdminQueryFn({ on401: "throw" }),
  });

  // Mutation for exporting user data
  const exportUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await adminApiRequest("GET", `/api/admin/user/${userId}/export`);
      return await response.json();
    },
    onSuccess: (data) => {
      // Generate filename based on username and date
      const filename = `${data.user.username}_export_${new Date().toISOString().split('T')[0]}.json`;
      
      // Create a downloadable JSON file
      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export successful",
        description: `Data for ${data.user.username} has been exported.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export user data",
        variant: "destructive",
      });
    }
  });
  
  // Mutation for deleting a user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await adminApiRequest("DELETE", `/api/admin/user/${userId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "The user account has been permanently deleted.",
      });
      
      // Invalidate queries to refresh the data
      adminQueryClient.invalidateQueries({ queryKey: ["/api/admin-users"] });
      adminQueryClient.invalidateQueries({ queryKey: ["/api/admin-stats"] });
      adminQueryClient.invalidateQueries({ queryKey: ["/api/admin-active-users"] });
      
      // Reset state
      setDeletingUserId(null);
      setIsDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Deletion failed",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
      setDeletingUserId(null);
      setIsDialogOpen(false);
    }
  });
  
  const handleExportUser = (userId: number) => {
    exportUserMutation.mutate(userId);
  };
  
  const confirmDeleteUser = (userId: number) => {
    setDeletingUserId(userId);
    setIsDialogOpen(true);
  };
  
  const handleDeleteUser = () => {
    if (deletingUserId) {
      deleteUserMutation.mutate(deletingUserId);
    }
  };
  
  const cancelDelete = () => {
    setDeletingUserId(null);
    setIsDialogOpen(false);
  };

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
    <>
      <Table>
        <TableCaption>Users active in the last 30 days</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Username</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Last Active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
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
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleExportUser(user.id)}
                    disabled={exportUserMutation.isPending}
                  >
                    {exportUserMutation.isPending && exportUserMutation.variables === user.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Export
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => confirmDeleteUser(user.id)}
                    disabled={deleteUserMutation.isPending}
                  >
                    {deleteUserMutation.isPending && deletingUserId === user.id ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user's account
              and all associated notes, moments, and analyses.
              
              <div className="mt-4 bg-amber-50 dark:bg-amber-950 p-3 rounded border border-amber-200 dark:border-amber-800">
                <p className="font-medium">Recommendation:</p>
                <p className="text-sm mt-1">Export the user's data before deletion by clicking the "Export" button.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteUser} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
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