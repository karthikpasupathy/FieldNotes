import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  // Detect iOS devices and check if it's a mobile device
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOSDevice(isIOS);
    
    // Check if it's a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobileDevice(isMobile);
  }, []);
  
  // Listen for the beforeinstallprompt event
  useEffect(() => {
    // Only proceed if it's a mobile device
    if (!isMobileDevice) {
      return;
    }
    
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      
      // Store the event for later use
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show our install prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };
    
    // Check if the app is already installed
    const isAppInstalled = window.matchMedia('(display-mode: standalone)').matches;
    
    if (!isAppInstalled) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isMobileDevice]);
  
  // Handle the install button click
  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt regardless of outcome
    setDeferredPrompt(null);
    setShowPrompt(false);
    
    // Log the outcome for analytics
    console.log(`User ${outcome} the PWA installation`);
  };
  
  // Hide the prompt when dismissed
  const dismissPrompt = () => {
    setShowPrompt(false);
    
    // Store in localStorage that the user dismissed the prompt
    // so we don't show it again for a while
    localStorage.setItem('installPromptDismissed', Date.now().toString());
  };
  
  // If nothing to show or not on a mobile device, render nothing
  if (!showPrompt || !isMobileDevice) {
    return null;
  }
  
  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 mx-auto max-w-sm px-4">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 relative">
        <button 
          onClick={dismissPrompt} 
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
        
        <div className="flex items-start mb-3">
          <div className="bg-purple-100 p-2 rounded-md mr-3">
            <Download className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Install Daynotes</h3>
            <p className="text-sm text-gray-600 mt-1">
              {isIOSDevice 
                ? 'Add this app to your home screen for quick access.'
                : 'Install this app on your device for offline use.'}
            </p>
          </div>
        </div>
        
        {isIOSDevice ? (
          <div className="text-xs text-gray-600 rounded bg-gray-50 p-2">
            Tap <span className="inline-block bg-gray-200 rounded px-1">Share</span> and then 
            <span className="inline-block bg-gray-200 rounded px-1 mx-1">&quot;Add to Home Screen&quot;</span>
          </div>
        ) : (
          <Button 
            onClick={handleInstallClick}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            Install App
          </Button>
        )}
      </div>
    </div>
  );
}