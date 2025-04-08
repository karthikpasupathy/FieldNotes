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
        console.log('Received genuine update message from service worker:', event.data);
        
        // We know this is a real update from the service worker
        handleRealUpdate(event.data.version);
      }
    };
    
    // Function to handle real updates that should be notified
    const handleRealUpdate = (newVersion: string) => {
      if (!newVersion) {
        console.warn('Received update notification without version information');
        return;
      }
      
      // Get the last recorded deployment version
      const lastKnownVersion = localStorage.getItem(DEPLOYMENT_VERSION_KEY);
      
      // Has this specific update notification been shown before?
      const notificationShownForVersion = localStorage.getItem(NOTIFICATION_SHOWN_KEY) === newVersion;
      
      console.log('Update check:', { 
        lastKnownVersion, 
        newVersion, 
        notificationShownForVersion,
        shouldShow: lastKnownVersion !== newVersion && !notificationShownForVersion
      });
      
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
      
      // Check for updates when the component mounts
      // This is particularly important for mobile PWAs that may stay open for long periods
      setTimeout(() => {
        if (navigator.serviceWorker.controller) {
          // Ask the service worker if there's an update
          navigator.serviceWorker.controller.postMessage({
            type: 'CHECK_UPDATE_STATUS'
          });
        }
      }, 2000); // Small delay to ensure service worker is ready
    }
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, []);
  
  const handleRefresh = () => {
    // Indicate we're processing the refresh
    console.log('Processing refresh request...');
    
    // For mobile PWAs and standalone mode, we need a more aggressive approach
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true;
    
    // For PWAs, we need to ensure the page is fully reloaded
    if ('serviceWorker' in navigator) {
      // First, tell service worker to skip waiting and activate immediately
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          console.log('Sending SKIP_WAITING message to service worker');
          registration.active.postMessage({ type: 'SKIP_WAITING' });
          
          // For mobile PWAs especially, we need to force a refresh
          setTimeout(() => {
            console.log('Forcing page refresh after service worker activation');
            // Use a cleaner URL approach that will still bypass the cache
            const url = new URL(window.location.href);
            url.searchParams.set('refresh', Date.now().toString());
            window.location.href = url.toString();
          }, 500);
        }
      }).catch(err => {
        console.error('Error during service worker refresh:', err);
        // Fallback for error cases
        window.location.reload();
      });
    } else {
      // Standard refresh for non-PWA
      console.log('No service worker, using standard reload');
      window.location.reload();
    }
    
    // Clear the notification shown flag to ensure it doesn't reappear
    localStorage.removeItem(NOTIFICATION_SHOWN_KEY);
    
    // Mobile-specific refresh handling
    if (isStandalone) {
      console.log('Running in standalone mode (PWA), using enhanced refresh method');
      // Add a visual indicator that refresh is happening
      document.body.style.opacity = '0.5';
      document.body.style.pointerEvents = 'none';
    }
  };
  
  const handleDismiss = () => {
    setShowNotification(false);
  };
  
  if (!showNotification) {
    return null;
  }
  
  // Use a more visible mobile-friendly banner in Daynotes theme colors
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#3b4e87] text-white py-3 px-4 shadow-md md:shadow-lg w-full">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between">
        <div className="flex items-center mb-3 sm:mb-0 w-full justify-center sm:justify-start">
          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          <p className="text-sm sm:text-base font-medium">A new version of Daynotes is available!</p>
        </div>
        <div className="flex items-center w-full justify-center sm:justify-end space-x-4">
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            size="sm"
            className="bg-[#ffc53d] text-[#3b4e87] border-[#ffc53d] hover:bg-[#eaf0f9] hover:text-[#3b4e87] hover:border-[#eaf0f9] px-4 py-1 text-sm font-medium whitespace-nowrap"
          >
            Refresh Now
          </Button>
          <button 
            onClick={handleDismiss}
            className="text-white hover:text-[#eaf0f9] flex-shrink-0"
            aria-label="Dismiss notification"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}