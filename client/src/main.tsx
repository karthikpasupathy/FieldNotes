import { createRoot } from "react-dom/client";
import App from "./App";
import AdminApp from "./AdminApp";
import "./index.css";
import { ChevronLeft, ChevronRight, Calendar, List, Settings, RefreshCw } from "lucide-react";
import { StrictMode } from "react";
import { toast } from "@/hooks/use-toast";

// Define custom icons to be consistent with design reference
export const CustomIcons = {
  ChevronLeft,
  ChevronRight,
  Calendar,
  List,
  Settings
};

// Define path map for different apps
type AppType = "main" | "admin";

const getAppType = (): AppType => {
  if (window.location.pathname.startsWith('/admin')) {
    return "admin";
  }
  return "main";
};

// Render appropriate app based on path
const root = createRoot(document.getElementById("root")!);
const appType = getAppType();

// Log service worker support status for debugging
console.log('[PWA] Service Worker support:', 'serviceWorker' in navigator ? 'Available' : 'Not available');

// Register service worker and enhance update handling
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Register the service worker with a more robust error handling approach
      console.log('[PWA] Registering service worker...');
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        // Use updateViaCache: 'none' to ensure we always check for updates
        updateViaCache: 'none',
        // Scope defines where the service worker controls - '/' is root
        scope: '/',
      });
      
      // Log successful registration
      console.log('[PWA] Service worker registered:', registration.scope);
      
      // Immediately check for updates
      console.log('[PWA] Checking for service worker updates...');
      await registration.update();
      
      // Listen for new workers
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[PWA] New service worker installing:', newWorker?.state);
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[PWA] Service worker state changed:', newWorker.state);
            
            // When the new worker is installed (but waiting), notify user
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New version available and installed');
              
              // Display toast notification in addition to the banner component
              // This gives users multiple ways to learn about updates
              toast({
                title: "App update available",
                description: "A new version of Daynotes is ready",
                action: (
                  <button
                    onClick={() => {
                      // Tell service worker to skip waiting and take control
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                      // Use cacheBusting parameter to ensure fresh content
                      window.location.href = window.location.href + 
                        (window.location.href.includes('?') ? '&' : '?') + 
                        'refresh=' + Date.now();
                    }}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update Now
                  </button>
                ),
                duration: 60000, // Keep notification visible for 1 minute
              });
              
              // Mobile PWA specific - try to broadcast the update to all clients
              // This ensures our UpdateNotification component gets the message
              navigator.serviceWorker.controller?.postMessage({ 
                type: 'BROADCAST_UPDATE',
                timestamp: new Date().toISOString(),
                clientVersion: new Date().toISOString() // Include version identifier
              });
            }
          });
        }
      });
      
      // Set up periodic update checks (important for long-lived PWAs)
      setInterval(() => {
        console.log('[PWA] Performing scheduled service worker update check');
        registration.update().catch(err => {
          console.warn('[PWA] Scheduled update check failed:', err);
        });
      }, 60 * 60 * 1000); // Check for updates once per hour
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
    }
  });
  
  // Listen for messages from the service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('[PWA] Received message from service worker:', event.data);
    
    // Handle any custom messages from the service worker
    if (event.data && event.data.type === 'APP_UPDATED') {
      console.log('[PWA] App updated notification received from service worker');
      
      // Get the last notification version shown
      const NOTIFICATION_SHOWN_KEY = 'daynotes-update-notification-shown';
      const DEPLOYMENT_VERSION_KEY = 'daynotes-deployment-version';
      
      // Get the last recorded deployment version
      const lastKnownVersion = localStorage.getItem(DEPLOYMENT_VERSION_KEY);
      
      // Has this specific update notification been shown before?
      const notificationShownForVersion = localStorage.getItem(NOTIFICATION_SHOWN_KEY) === event.data.version;
      
      // Only show notification if:
      // 1. This is a genuinely new version
      // 2. We haven't shown the notification for this version yet
      if (lastKnownVersion !== event.data.version && !notificationShownForVersion) {
        // The UpdateNotification component will handle showing the banner
        // but we add this toast as a backup mechanism
        toast({
          title: "Update Available",
          description: "Refresh to get the latest version of Daynotes",
          variant: "default",
          duration: 10000, // 10 seconds
        });
      }
    }
  });
}

// Use separate entry points for admin and main apps to avoid hook sharing issues
if (appType === "admin") {
  root.render(
    <StrictMode>
      <AdminApp />
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
