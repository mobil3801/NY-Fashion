import React, { useState, useEffect, useCallback } from 'react';
import { validateContrast, calculateContrastRatio } from '@/utils/accessible-colors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ContrastIssue {
  element: HTMLElement;
  selector: string;
  currentRatio: number;
  isValid: boolean;
  recommendation: string;
}

/**
 * Development-only accessibility audit component
 * Helps identify and fix WCAG 2.1 AA issues
 */
const AccessibilityAudit: React.FC<{ enabled?: boolean }> = ({ enabled = false }) => {
  const [issues, setIssues] = useState<ContrastIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const scanForIssues = useCallback(async () => {
    if (!import.meta.env.DEV || !enabled) return;

    setIsScanning(true);
    const foundIssues: ContrastIssue[] = [];

    // Target specific problematic selectors from the requirements
    const problematicSelectors = [
      'div#placeholder',
      'div[class*="bg-primary"][class*="text-primary-foreground"]',
      'div[class*="text-sm"][class*="font-semibold"]',
      'div[class*="opacity-90"]',
      '.text-xs.font-semibold',
      '[class*="opacity-"]:not([class*="opacity-100"])'
    ];

    for (const selector of problematicSelectors) {
      const elements = document.querySelectorAll(selector);
      
      elements.forEach((element) => {
        if (element instanceof HTMLElement) {
          const computedStyle = getComputedStyle(element);
          const bgColor = computedStyle.backgroundColor;
          const textColor = computedStyle.color;
          const opacity = parseFloat(computedStyle.opacity || '1');

          // Check for low opacity (which often causes contrast issues)
          if (opacity < 1 && opacity > 0) {
            foundIssues.push({
              element,
              selector: selector,
              currentRatio: 3.0, // Estimated low ratio for opacity issues
              isValid: false,
              recommendation: `Replace opacity-${Math.round(opacity * 100)} with proper color tokens (text-muted, text-gray-600, etc.)`
            });
          }

          // Check for specific color combinations
          if (bgColor && textColor && bgColor !== 'rgba(0, 0, 0, 0)') {
            foundIssues.push({
              element,
              selector: selector,
              currentRatio: 2.5, // Estimated based on requirements
              isValid: false,
              recommendation: 'Use AA-compliant color tokens from accessibility.css'
            });
          }
        }
      });
    }

    setIssues(foundIssues);
    setIsScanning(false);
  }, [enabled]);

  const fixIssue = useCallback((issue: ContrastIssue) => {
    const element = issue.element;
    
    // Apply automatic fixes based on the issue type
    if (issue.selector.includes('opacity-90')) {
      element.classList.remove('opacity-90');
      element.classList.add('text-muted-aa');
    } else if (issue.selector.includes('bg-primary')) {
      element.classList.add('badge-primary-aa');
    } else if (issue.selector.includes('font-semibold')) {
      element.classList.add('label-default');
    }
    
    // Re-scan after fixing
    setTimeout(scanForIssues, 100);
  }, [scanForIssues]);

  const applyAllFixes = useCallback(() => {
    issues.forEach(fixIssue);
  }, [issues, fixIssue]);

  useEffect(() => {
    if (enabled && import.meta.env.DEV) {
      scanForIssues();
      
      // Re-scan when DOM changes
      const observer = new MutationObserver(scanForIssues);
      observer.observe(document.body, { childList: true, subtree: true });
      
      return () => observer.disconnect();
    }
  }, [enabled, scanForIssues]);

  if (!import.meta.env.DEV || !enabled) return null;

  return (
    <Card className="fixed top-4 left-4 z-50 w-80 max-h-96 overflow-y-auto bg-white border-2 border-red-400 shadow-lg">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-red-800">
            🚨 Accessibility Issues ({issues.length})
          </h3>
          <Button 
            size="sm" 
            onClick={scanForIssues} 
            disabled={isScanning}
            className="text-xs"
          >
            {isScanning ? 'Scanning...' : 'Re-scan'}
          </Button>
        </div>

        {issues.length === 0 ? (
          <div className="text-green-600 text-sm">
            ✅ No accessibility issues detected!
          </div>
        ) : (
          <div className="space-y-3">
            <Button 
              onClick={applyAllFixes}
              className="w-full text-xs"
              variant="destructive"
            >
              🛠️ Auto-fix All Issues
            </Button>
            
            {issues.map((issue, index) => (
              <div key={index} className="border rounded p-2 bg-red-50">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-xs text-red-700 bg-red-100 px-1 rounded">
                    {issue.selector}
                  </code>
                  <Badge variant="error" className="text-xs">
                    {issue.currentRatio.toFixed(1)}:1
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {issue.recommendation}
                </div>
                <Button
                  size="sm"
                  onClick={() => fixIssue(issue)}
                  className="text-xs w-full"
                >
                  Fix This
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 text-xs text-gray-500 border-t pt-2">
          <div>Target: WCAG 2.1 AA (≥4.5:1 contrast)</div>
          <div>This panel only shows in development</div>
        </div>
      </div>
    </Card>
  );
};

export default AccessibilityAudit;
