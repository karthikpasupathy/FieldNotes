import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, Users, FileText, BarChart2, Calendar, RefreshCw, LogOut } from 'lucide-react';
import { queryClient, getQueryFn } from '@/lib/queryClient';
import { useLocation } from 'wouter';

// Type definitions
interface UserCount {
  count: number;
}

interface ActiveUsers {
  count: number;
  days: number;
}

interface AnalysisCounts {
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
}

interface SignupData {
  date: string;
  count: number;
}

interface UserActivity {
  username: string;
  noteCount: number;
  lastActive: Date | null;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [timeFrame, setTimeFrame] = useState(30); // Default to 30 days
  const [, setLocation] = useLocation();
  
  // No longer need to check admin status here as that's handled by the AdminRoute component

  // Queries for fetching dashboard data
  const { data: totalUsers, isLoading: loadingUsers } = useQuery<UserCount>({
    queryKey: ['/api/admin/users/count'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: activeUsers, isLoading: loadingActive, refetch: refetchActive } = useQuery<ActiveUsers>({
    queryKey: ['/api/admin/users/active', timeFrame],
    queryFn: () => fetch(`/api/admin/users/active?days=${timeFrame}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch active users');
      return res.json();
    }),
  });

  const { data: totalNotes, isLoading: loadingNotes } = useQuery<UserCount>({
    queryKey: ['/api/admin/notes/count'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: analysisCounts, isLoading: loadingAnalyses } = useQuery<AnalysisCounts>({
    queryKey: ['/api/admin/analyses/count'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: signupData, isLoading: loadingSignups, refetch: refetchSignups } = useQuery<SignupData[]>({
    queryKey: ['/api/admin/signups', timeFrame],
    queryFn: () => fetch(`/api/admin/signups?days=${timeFrame}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch signup data');
      return res.json();
    }),
  });

  const { data: userActivity, isLoading: loadingActivity, refetch: refetchActivity } = useQuery<UserActivity[]>({
    queryKey: ['/api/admin/user-activity', timeFrame],
    queryFn: () => fetch(`/api/admin/user-activity?days=${timeFrame}`).then(res => {
      if (!res.ok) throw new Error('Failed to fetch user activity');
      return res.json();
    }),
  });

  // Handler for changing time frame
  const handleTimeFrameChange = (days: number) => {
    setTimeFrame(days);
  };

  // Handler for refreshing all data
  const refreshAllData = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/users/count'] });
    refetchActive();
    queryClient.invalidateQueries({ queryKey: ['/api/admin/notes/count'] });
    queryClient.invalidateQueries({ queryKey: ['/api/admin/analyses/count'] });
    refetchSignups();
    refetchActivity();
    
    toast({
      title: "Data Refreshed",
      description: "Dashboard data has been updated.",
    });
  };
  
  // Handler for admin logout
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        toast({
          title: "Logged Out",
          description: "You have been logged out of the admin panel.",
        });
        // Redirect to admin login page
        setLocation('/admin-login');
      } else {
        toast({
          title: "Logout Failed",
          description: "There was an error logging out.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({
        title: "Logout Failed",
        description: "There was an error logging out.",
        variant: "destructive"
      });
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format date for last active
  const formatLastActive = (date: Date | null) => {
    if (!date) return 'Never';
    
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  const isLoading = loadingUsers || loadingActive || loadingNotes || 
                    loadingAnalyses || loadingSignups || loadingActivity;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            View and analyze application usage and statistics
          </p>
        </div>
        <div className="flex items-center mt-4 md:mt-0 space-x-2">
          <div className="flex space-x-2">
            <Button
              variant={timeFrame === 7 ? "default" : "outline"}
              onClick={() => handleTimeFrameChange(7)}
            >
              7 Days
            </Button>
            <Button
              variant={timeFrame === 30 ? "default" : "outline"}
              onClick={() => handleTimeFrameChange(30)}
            >
              30 Days
            </Button>
            <Button
              variant={timeFrame === 90 ? "default" : "outline"}
              onClick={() => handleTimeFrameChange(90)}
            >
              90 Days
            </Button>
          </div>
          <Button onClick={refreshAllData} className="ml-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleLogout} className="ml-2">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading dashboard data...</span>
        </div>
      ) : (
        <>
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalUsers?.count || 0}</div>
                <p className="text-muted-foreground text-sm mt-1">Registered accounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  Active Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{activeUsers?.count || 0}</div>
                <p className="text-muted-foreground text-sm mt-1">
                  In the last {activeUsers?.days || timeFrame} days
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary" />
                  Total Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalNotes?.count || 0}</div>
                <p className="text-muted-foreground text-sm mt-1">Field notes created</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium flex items-center">
                  <BarChart2 className="h-5 w-5 mr-2 text-primary" />
                  AI Analyses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {(analysisCounts?.dailyCount || 0) + 
                   (analysisCounts?.weeklyCount || 0) + 
                   (analysisCounts?.monthlyCount || 0)}
                </div>
                <div className="flex justify-between text-muted-foreground text-xs mt-1">
                  <span>Daily: {analysisCounts?.dailyCount || 0}</span>
                  <span>Weekly: {analysisCounts?.weeklyCount || 0}</span>
                  <span>Monthly: {analysisCounts?.monthlyCount || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Signups */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-primary" />
                  Recent Signups
                </CardTitle>
                <CardDescription>
                  New user registrations in the last {timeFrame} days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {signupData && signupData.length > 0 ? (
                  <div className="space-y-2">
                    {signupData.map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="font-medium">{formatDate(item.date)}</span>
                        <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                          {item.count} user{item.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No new signups in the last {timeFrame} days
                  </div>
                )}
              </CardContent>
            </Card>

            {/* User Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-primary" />
                  User Activity
                </CardTitle>
                <CardDescription>
                  Recent user activity and note creation
                </CardDescription>
              </CardHeader>
              <CardContent className="max-h-96 overflow-auto">
                {userActivity && userActivity.length > 0 ? (
                  <div className="space-y-4">
                    {userActivity.map((user, index) => (
                      <div key={index} className="border-b pb-3 last:border-0">
                        <div className="flex justify-between">
                          <span className="font-medium">{user.username}</span>
                          <span className="text-sm bg-primary/10 text-primary px-2 py-1 rounded-full">
                            {user.noteCount} note{user.noteCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Last active: {formatLastActive(user.lastActive)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No user activity data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}