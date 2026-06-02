import { useState, useEffect } from 'react';

/**
 * Custom React hook to detect if the on-screen virtual keyboard is active on mobile devices.
 * Compares the visual viewport height against screen dimensions to determine keyboard states.
 */
export function useKeyboardActive(): boolean {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);

  useEffect(() => {
    // 1. Safe boundary check for SSR or server contexts
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      const visualViewport = window.visualViewport;
      
      if (visualViewport) {
        const screenHeight = window.screen.height;
        const viewportHeight = visualViewport.height;
        
        // If the visual viewport height drops below 75% of total screen height,
        // the virtual keyboard is active.
        setIsKeyboardActive(viewportHeight < screenHeight * 0.75);
      } else {
        // Fallback height analysis
        const screenHeight = window.innerHeight;
        setIsKeyboardActive(screenHeight < 500); // Simple threshold checks
      }
    };

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    // Call once initially
    handleResize();

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return isKeyboardActive;
}
