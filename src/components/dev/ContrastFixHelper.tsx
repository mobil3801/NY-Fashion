import React, { useEffect } from 'react';
import { createContrastChecker } from '@/utils/accessible-colors';

interface ContrastFixHelperProps {
  enabled?: boolean;
}

/**
 * Development component to identify and highlight contrast issues
 * Only active in development mode
 */
const ContrastFixHelper: React.FC<ContrastFixHelperProps> = ({ enabled = false }) => {
  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;

    const checkContrast = () => {
      // Target the specific elements mentioned in the requirements
      const selectors = [
        'div#placeholder',
        'div[class*="bg-primary"][class*="text-primary-foreground"]',
        'div[class*="text-sm"][class*="font-semibold"]',
        'div[class*="text-sm"][class*="opacity-90"]',
        '.badge',
        '[class*="opacity-"]'
      ];

      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            createContrastChecker(el);
          }
        });
      });
    };

    // Check on mount
    checkContrast();

    // Check on mutations (new elements added)
    const observer = new MutationObserver(checkContrast);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [enabled]);

  // Don't render anything in production
  if (!import.meta.env.DEV || !enabled) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-3 text-sm">
      <div className="font-semibold text-yellow-800">🔍 Contrast Checker Active</div>
      <div className="text-yellow-700">
        Checking for WCAG AA compliance...
      </div>
    </div>
  );
};

export default ContrastFixHelper;
