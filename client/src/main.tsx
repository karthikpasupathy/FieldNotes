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

// Register service worker and handle updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(registration => {
      // Check for service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available; show notification to user
              toast({
                title: "App update available",
                description: "Refresh the page to get the latest version",
                action: (
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Update
                  </button>
                ),
                duration: 60000, // Keep notification visible for 1 minute
              });
            }
          });
        }
      });
    }).catch(error => {
      console.error('Service worker registration failed:', error);
    });
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
