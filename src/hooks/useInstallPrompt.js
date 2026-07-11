import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useInstallPrompt
 * Captures the browser's `beforeinstallprompt` event so a custom, in-app
 * install button can be shown instead of relying on the native browser UI.
 * The button naturally hides itself when the app isn't installable and
 * after a successful install (via the `appinstalled` event).
 */
export function useInstallPrompt() {
  const deferredPromptRef = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPromptRef.current = event;
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return null;

    promptEvent.prompt();
    const choice = await promptEvent.userChoice;

    deferredPromptRef.current = null;
    setCanInstall(false);

    return choice.outcome; // 'accepted' | 'dismissed'
  }, []);

  return { canInstall, isInstalled, promptInstall };
}
