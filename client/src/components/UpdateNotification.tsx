import { useState, useEffect } from 'react';
import { XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Cache key names for consistent version tracking
const VERSION_CACHE_KEY = 'daynotes-app-version';
const UPDATE_CHECK_KEY = 'daynotes-last-update-check';

export default function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  
  // Force app to check for updates regularly (especially important for PWA installs)
  const checkForUpdates = () => {
    const lastVersion = localStorage.getItem(VERSION_CACHE_KEY);
    // Current version based on timestamp - updating this daily forces refresh
    const currentVersion = new Date().toISOString().split('T')[0]; 
    
    // If there's a version mismatch, show the notification
    if (lastVersion && lastVersion !== currentVersion) {
      console.log('Version change detected:', lastVersion, '->', currentVersion);
      setShowNotification(true);
    }
    
    // Store current version and last check time
    localStorage.setItem(VERSION_CACHE_KEY, currentVersion);
    localStorage.setItem(UPDATE_CHECK_KEY, new Date().toISOString());
  };
  
  useEffect(() => {
    // Listen for messages from service worker
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'APP_UPDATED') {
        console.log('Received update message from service worker');
        setShowNotification(true);
      }
    };
    
    // Register service worker message listener
    if ('serviceWorker' in navigator) {
      // Listen to messages from all service workers
      navigator.serviceWorker.addEventListener('message', onMessage);
      
      // Request update status from any active worker
      navigator.serviceWorker.ready.then(registration => {
        if (registration.active) {
          registration.active.postMessage({ type: 'CHECK_UPDATE_STATUS' });
        }
      });
    }
    
    // Check for updates on initial load
    checkForUpdates();
    
    // Also set up periodic checking (important for PWAs that stay open for days)
    const updateInterval = setInterval(() => {
      checkForUpdates();
    }, 60 * 60 * 1000); // Check once per hour
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
      clearInterval(updateInterval);
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
      window.location.href = window.location.href + '?refresh=' + Date.now();
    } else {
      // Standard refresh for non-PWA
      window.location.reload(); // Force reload from server
    }
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