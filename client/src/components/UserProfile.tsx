import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, KeyRound, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function UserProfile() {
  const { user, logoutMutation } = useAuth();
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getInitials = () => {
    // For users with name
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    // For users with username
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    // Fallback using email
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "??";
  };
  
  const handleExportAllNotes = async () => {
    try {
      setIsExporting(true);
      
      toast({
        title: "Exporting notes",
        description: "Preparing all your notes for export..."
      });
      
      // Start the download
      const response = await fetch('/api/export-all');
      
      if (!response.ok) {
        // If we get a 404, it means there are no notes to export
        if (response.status === 404) {
          toast({
            title: "No notes to export",
            description: "You don't have any notes to export yet.",
            variant: "destructive"
          });
          setIsExporting(false);
          return;
        }
        
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      // Get the blob from the response
      const blob = await response.blob();
      
      // Create an object URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and click it to download the file
      const a = document.createElement('a');
      a.href = url;
      a.download = "daynotes-export.zip";
      document.body.appendChild(a);
      a.click();
      
      // Clean up by removing the link and revoking the URL
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export complete",
        description: "All your notes have been exported successfully!"
      });
    } catch (error) {
      console.error("Error exporting notes:", error);
      toast({
        title: "Export failed",
        description: "There was a problem exporting your notes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border border-primary/10">
            <AvatarImage 
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${getInitials()}`} 
              alt={user.username || "User"} 
            />
            <AvatarFallback>{getInitials()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.name || user.username || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/profile")}>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => navigate("/reset-password")}>
          <KeyRound className="mr-2 h-4 w-4" />
          <span>Reset Password</span>
        </DropdownMenuItem>
        <DropdownMenuItem 
          className="cursor-pointer" 
          onClick={handleExportAllNotes}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          <span>{isExporting ? "Exporting..." : "Export all notes"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className="cursor-pointer text-destructive focus:text-destructive" 
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}