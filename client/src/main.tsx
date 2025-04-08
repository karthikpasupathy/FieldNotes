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
      // The UpdateNotification component will handle showing the banner
      // No toast needed as the banner is more reliable and visible
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
