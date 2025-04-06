import { useState, useEffect } from 'react';
import { XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Cache key names for consistent version tracking
const DEPLOYMENT_VERSION_KEY = 'daynotes-deployment-version';
const NOTIFICATION_SHOWN_KEY = 'daynotes-update-notification-shown';

export default function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  
  useEffect(() => {
    // Only listen for actual service worker update messages
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'APP_UPDATED') {
        console.log('Received genuine update message from service worker');
        
        // We know this is a real update from the service worker
        handleRealUpdate(event.data.version);
      }
    };
    
    // Function to handle real updates that should be notified
    const handleRealUpdate = (newVersion: string) => {
      // Get the last recorded deployment version
      const lastKnownVersion = localStorage.getItem(DEPLOYMENT_VERSION_KEY);
      
      // Has this specific update notification been shown before?
      const notificationShownForVersion = localStorage.getItem(NOTIFICATION_SHOWN_KEY) === newVersion;
      
      // Only show notification if:
      // 1. This is a genuinely new version
      // 2. We haven't shown the notification for this version yet
      if (lastKnownVersion !== newVersion && !notificationShownForVersion) {
        console.log('New deployment detected:', lastKnownVersion, '->', newVersion);
        setShowNotification(true);
        
        // Mark this version as having shown a notification
        localStorage.setItem(NOTIFICATION_SHOWN_KEY, newVersion);
      }
      
      // Always record the latest version
      localStorage.setItem(DEPLOYMENT_VERSION_KEY, newVersion);
    };
    
    // Only set up service worker listeners if the browser supports it
    if ('serviceWorker' in navigator) {
      // Listen for messages from any service worker
      navigator.serviceWorker.addEventListener('message', onMessage);
      
      // We don't automatically ask for status on page load
      // This prevents the notification from showing on every page load
    }
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, []);
  
  const handleRefresh = () => {
    // For PWAs, we need to ensure the page is fully reloaded
    if ('serviceWorker' in navigator) {
      // Tell service worker to skip cache for next load
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage({ type: 'SKIP_WAITING' });
        }
      });
      
      // Use a more aggressive reload method that bypasses cache
      window.location.href = window.location.href + 
        (window.location.href.includes('?') ? '&' : '?') + 
        'refresh=' + Date.now();
    } else {
      // Standard refresh for non-PWA
      window.location.reload();
    }
    
    // Clear the notification shown flag to ensure it doesn't reappear
    localStorage.removeItem(NOTIFICATION_SHOWN_KEY);
  };
  
  const handleDismiss = () => {
    setShowNotification(false);
  };
  
  if (!showNotification) {
    return null;
  }
  
  // Use a more visible mobile-friendly banner
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-4 shadow-lg">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between">
        <div className="flex items-center mb-2 sm:mb-0">
          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          <p className="text-sm sm:text-base font-medium">A new version of Daynotes is available!</p>
        </div>
        <div className="flex items-center w-full sm:w-auto justify-between sm:justify-end">
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            size="sm"
            className="mr-3 text-white border-white hover:bg-white hover:text-purple-600 px-4 py-1 text-sm font-medium"
          >
            Refresh Now
          </Button>
          <button 
            onClick={handleDismiss}
            className="text-white hover:text-gray-200"
            aria-label="Dismiss notification"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}