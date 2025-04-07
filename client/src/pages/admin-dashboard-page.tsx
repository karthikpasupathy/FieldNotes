import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, Users, BookText, Brain, UserCheck, LogOut, Mail, Plus, X } from "lucide-react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

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
  const [features, setFeatures] = useState<string[]>([""]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { logout, isAuthenticated } = useAdminAuth();
  const { toast } = useToast();

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
      
      {/* Marketing Email Section */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-medium">Send Marketing Email</CardTitle>
            <Mail className="h-5 w-5 text-blue-500" />
          </div>
          <CardDescription>
            Send an announcement email to all registered users highlighting new features
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
                    <Mail className="h-4 w-4 mr-2" />
                    Send to All Users
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Users listing section could be added here */}
      
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