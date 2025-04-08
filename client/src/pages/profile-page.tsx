import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Loader2, 
  ArrowLeft, 
  Download, 
  Lock, 
  LockOpen, 
  AlertTriangle, 
  Info, 
  Shield, 
  ShieldAlert 
} from "lucide-react";
import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function ProfilePage() {
  const { 
    user, 
    isLoading, 
    isEncryptionAvailable,
    enableEncryptionMutation,
    disableEncryptionMutation
  } = useAuth();
  
  const [_, navigate] = useLocation();
  const [isEnableDialogOpen, setIsEnableDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const getInitials = () => {
    if (user.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }
    return user.username.substring(0, 2).toUpperCase();
  };

  const handleEnableEncryption = () => {
    enableEncryptionMutation.mutate(undefined, {
      onSuccess: () => {
        setIsEnableDialogOpen(false);
      }
    });
  };

  const handleDisableEncryption = () => {
    disableEncryptionMutation.mutate({ confirmPassword }, {
      onSuccess: () => {
        setIsDisableDialogOpen(false);
        setConfirmPassword('');
      }
    });
  };

  return (
    <div className="container max-w-5xl py-8">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Notes
      </Button>

      <div className="grid gap-6 md:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader className="text-center">
            <Avatar className="h-24 w-24 mx-auto border-2 border-primary/20">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${getInitials()}`} alt={user.username} />
              <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
            </Avatar>
            <CardTitle className="mt-4">{user.name || user.username}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{user.username}</span>
            </div>
            {user.name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{user.name}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2">
              <span className="text-muted-foreground">Encryption:</span>
              <span className="font-medium flex items-center">
                {user.encryptionEnabled ? (
                  <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200 flex items-center">
                    <Shield className="w-3 h-3 mr-1" /> Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 flex items-center">
                    <ShieldAlert className="w-3 h-3 mr-1" /> Disabled
                  </Badge>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account preferences and security options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full" onClick={() => navigate("/reset-password")}>
                Change Password
              </Button>
            </CardContent>
          </Card>

          {/* End-to-End Encryption Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>End-to-End Encryption</CardTitle>
                {user.encryptionEnabled && (
                  <Badge className="bg-primary/10 text-primary border-0">
                    <Lock className="w-3 h-3 mr-1" /> Active
                  </Badge>
                )}
              </div>
              <CardDescription>
                Protect your notes with end-to-end encryption
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className={`mb-4 ${user.encryptionEnabled ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                <Info className="h-4 w-4" />
                <AlertTitle>
                  {user.encryptionEnabled 
                    ? "Your notes are encrypted" 
                    : "Your notes are not encrypted"}
                </AlertTitle>
                <AlertDescription>
                  {user.encryptionEnabled 
                    ? "Only you can read your notes. They're encrypted before leaving your device." 
                    : "Enable encryption to protect your notes from being read by anyone else."}
                </AlertDescription>
              </Alert>

              <Accordion type="single" collapsible className="mb-4">
                <AccordionItem value="encryption-details">
                  <AccordionTrigger>How encryption works</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground space-y-2">
                    <p>
                      End-to-end encryption means your notes are encrypted on your device before
                      being sent to our servers. Only you can decrypt and read them.
                    </p>
                    <p>
                      The encryption key is derived from your password and never leaves your device.
                      Your notes will be automatically encrypted when you add new ones and decrypted
                      when you view them.
                    </p>
                    <p className="font-medium text-destructive">
                      Important: If you forget your password, your encrypted notes cannot be recovered.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {!isEncryptionAvailable && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Encryption not available</AlertTitle>
                  <AlertDescription>
                    Your browser doesn't support the encryption features required.
                    Try using a modern browser like Chrome, Firefox, or Edge.
                  </AlertDescription>
                </Alert>
              )}

              {user.encryptionEnabled ? (
                <Button 
                  variant="outline" 
                  className="w-full border-red-200 hover:border-red-300 hover:bg-red-50"
                  onClick={() => setIsDisableDialogOpen(true)}
                  disabled={!isEncryptionAvailable || disableEncryptionMutation.isPending}
                >
                  {disableEncryptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <LockOpen className="mr-2 h-4 w-4" />
                  Disable Encryption
                </Button>
              ) : (
                <Button 
                  variant="default" 
                  className="w-full"
                  onClick={() => setIsEnableDialogOpen(true)}
                  disabled={!isEncryptionAvailable || enableEncryptionMutation.isPending}
                >
                  {enableEncryptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Lock className="mr-2 h-4 w-4" />
                  Enable Encryption
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data Export</CardTitle>
              <CardDescription>
                Export your notes as markdown files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                You can export your notes for any particular day from the main notes view by selecting the date and clicking the export button.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                <Download className="mr-2 h-4 w-4" />
                Go to Notes to Export
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Enable Encryption Dialog */}
      <Dialog open={isEnableDialogOpen} onOpenChange={setIsEnableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable End-to-End Encryption</DialogTitle>
            <DialogDescription>
              This will encrypt all your existing and future notes to protect your privacy.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-800">Important</AlertTitle>
              <AlertDescription className="text-amber-700">
                <ul className="list-disc pl-4 mt-2 space-y-1">
                  <li>Encryption uses your password to generate your encryption key</li>
                  <li>You'll need to log in on each device to access your encrypted notes</li>
                  <li>If you forget your password, your encrypted notes cannot be recovered</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEnableDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={handleEnableEncryption}
              disabled={enableEncryptionMutation.isPending}
            >
              {enableEncryptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enable Encryption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Encryption Dialog */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable End-to-End Encryption</DialogTitle>
            <DialogDescription>
              This will decrypt your notes and disable encryption protection.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                Disabling encryption means your notes will no longer be protected.
                Anyone with database access could potentially read your notes.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm your password</Label>
              <Input 
                id="confirm-password" 
                type="password" 
                placeholder="Enter your current password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDisableDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDisableEncryption}
              disabled={!confirmPassword || disableEncryptionMutation.isPending}
            >
              {disableEncryptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disable Encryption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}