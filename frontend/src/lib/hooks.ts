import { useEffect, useRef } from 'react';

/** Reload when the browser tab becomes active again, so new claims appear. */
export function useReloadOnFocus(callback: () => void): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const reload = () => callbackRef.current();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reload();
    };
    window.addEventListener('focus', reload);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', reload);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}
