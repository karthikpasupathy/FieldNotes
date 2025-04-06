import { useState, useEffect } from 'react';
import { XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UpdateNotification() {
  const [showNotification, setShowNotification] = useState(false);
  
  useEffect(() => {
    // Listen for messages from service worker
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'APP_UPDATED') {
        setShowNotification(true);
      }
    };
    
    // Register service worker if not already registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        // Add message listener for the active service worker
        navigator.serviceWorker.addEventListener('message', onMessage);
      });
    }
    
    // Also check on first load if there's a version mismatch
    const lastVersion = localStorage.getItem('app-version');
    const currentVersion = process.env.NODE_ENV === 'production' 
      ? new Date().toISOString().split('T')[0] 
      : new Date().toISOString();
      
    if (lastVersion && lastVersion !== currentVersion) {
      setShowNotification(true);
    }
    
    // Store current version
    localStorage.setItem('app-version', currentVersion);
    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onMessage);
      }
    };
  }, []);
  
  const handleRefresh = () => {
    // Force reload the page to get the newest version
    window.location.reload();
  };
  
  const handleDismiss = () => {
    setShowNotification(false);
  };
  
  if (!showNotification) {
    return null;
  }
  
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
          <p>A new version of Daynotes is available!</p>
        </div>
        <div className="flex items-center">
          <Button 
            onClick={handleRefresh}
            variant="outline" 
            size="sm"
            className="mr-2 text-white border-white hover:bg-white hover:text-purple-600"
          >
            Refresh Now
          </Button>
          <button 
            onClick={handleDismiss}
            className="text-white hover:text-gray-200"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}