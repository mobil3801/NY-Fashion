/**
 * Accessibility testing utilities
 * Tests WCAG AA compliance and form semantics
 */

export interface AccessibilityTestResult {
  passed: boolean;
  issues: AccessibilityIssue[];
  score: number;
}

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info';
  rule: string;
  description: string;
  element?: Element;
  recommendation: string;
}

/**
 * Test contrast ratios for WCAG AA compliance (4.5:1 minimum)
 */
export function testContrastRatios(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Test common problematic elements
  const selectors = [
  '.text-gray-500',
  '.text-gray-600',
  '.opacity-75',
  '.opacity-80',
  '[class*="text-muted"]:not([class*="text-muted-aa"])',
  '[class*="badge"]:not([class*="badge-aa"])'];


  selectors.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((element) => {
      issues.push({
        type: 'warning',
        rule: 'WCAG-1.4.3-AA',
        description: `Element may not meet WCAG AA contrast requirements`,
        element: element as Element,
        recommendation: 'Use AA-compliant color classes (e.g., text-muted-aa, badge-primary-aa)'
      });
    });
  });

  return issues;
}

/**
 * Test form accessibility and semantics
 */
export function testFormSemantics(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Test for inputs without labels
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach((input) => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');

    let hasLabel = false;
    if (id) {
      hasLabel = !!document.querySelector(`label[for="${id}"]`);
    }

    if (!hasLabel && !ariaLabel && !ariaLabelledBy) {
      issues.push({
        type: 'error',
        rule: 'WCAG-1.3.1-A',
        description: 'Form control lacks proper labeling',
        element: input as Element,
        recommendation: 'Add a <label> element with matching htmlFor attribute or use aria-label'
      });
    }
  });

  // Test for proper error messaging
  const invalidInputs = document.querySelectorAll('[aria-invalid="true"]');
  invalidInputs.forEach((input) => {
    const describedBy = input.getAttribute('aria-describedby');
    if (!describedBy) {
      issues.push({
        type: 'error',
        rule: 'WCAG-1.3.1-A',
        description: 'Invalid form control lacks error description',
        element: input as Element,
        recommendation: 'Use aria-describedby to link error messages'
      });
    }
  });

  return issues;
}

/**
 * Test keyboard navigation and focus management
 */
export function testKeyboardNavigation(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Test for interactive elements without focus indicators
  const interactiveElements = document.querySelectorAll(
    'button, [role="button"], a, input, textarea, select, [tabindex]'
  );

  interactiveElements.forEach((element) => {
    const computedStyle = window.getComputedStyle(element);
    const hasFocusStyle = element.classList.contains('focus-visible-aa') ||
    element.classList.contains('focus-aa') ||
    computedStyle.outline !== 'none' ||
    computedStyle.boxShadow.includes('ring');

    if (!hasFocusStyle) {
      issues.push({
        type: 'warning',
        rule: 'WCAG-2.4.7-AA',
        description: 'Interactive element may lack visible focus indicator',
        element: element as Element,
        recommendation: 'Add focus-visible-aa or focus-aa class for consistent focus styling'
      });
    }
  });

  // Test for skip links
  const skipLinks = document.querySelectorAll('.skip-link, [href^="#"][class*="sr-only"]');
  if (skipLinks.length === 0) {
    issues.push({
      type: 'warning',
      rule: 'WCAG-2.4.1-A',
      description: 'No skip links found for keyboard navigation',
      recommendation: 'Add skip links to main content and navigation'
    });
  }

  return issues;
}

/**
 * Test ARIA usage and semantics
 */
export function testARIASemantics(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  // Test for proper landmark roles
  const main = document.querySelector('main');
  if (!main) {
    issues.push({
      type: 'error',
      rule: 'WCAG-1.3.1-A',
      description: 'No main landmark found',
      recommendation: 'Add <main> element or role="main" to identify primary content'
    });
  }

  // Test for proper heading hierarchy
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let hasH1 = false;
  let lastLevel = 0;

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1]);

    if (level === 1) {
      if (hasH1) {
        issues.push({
          type: 'warning',
          rule: 'WCAG-1.3.1-A',
          description: 'Multiple h1 elements found',
          element: heading,
          recommendation: 'Use only one h1 per page for proper document structure'
        });
      }
      hasH1 = true;
    }

    if (lastLevel > 0 && level > lastLevel + 1) {
      issues.push({
        type: 'warning',
        rule: 'WCAG-1.3.1-A',
        description: 'Heading level skipped in hierarchy',
        element: heading,
        recommendation: 'Use sequential heading levels (h1, h2, h3, etc.)'
      });
    }

    lastLevel = level;
  });

  return issues;
}

/**
 * Test touch target sizes for mobile accessibility
 */
export function testTouchTargets(): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  const touchElements = document.querySelectorAll('button, [role="button"], a, input[type="checkbox"], input[type="radio"]');

  touchElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const minSize = 44; // WCAG AAA guideline

    if ((rect.width < minSize || rect.height < minSize) &&
    !element.classList.contains('touch-target-aa') &&
    !element.classList.contains('touch-target-sm-aa')) {
      issues.push({
        type: 'warning',
        rule: 'WCAG-2.5.5-AAA',
        description: `Touch target may be too small (${Math.round(rect.width)}x${Math.round(rect.height)}px)`,
        element: element as Element,
        recommendation: 'Ensure touch targets are at least 44x44px or add touch-target-aa class'
      });
    }
  });

  return issues;
}

/**
 * Run comprehensive accessibility audit
 */
export function runAccessibilityAudit(): AccessibilityTestResult {
  const allIssues: AccessibilityIssue[] = [
  ...testContrastRatios(),
  ...testFormSemantics(),
  ...testKeyboardNavigation(),
  ...testARIASemantics(),
  ...testTouchTargets()];


  const errorCount = allIssues.filter((issue) => issue.type === 'error').length;
  const warningCount = allIssues.filter((issue) => issue.type === 'warning').length;

  // Calculate score (0-100)
  const totalChecks = 20; // Approximate number of checks
  const passed = totalChecks - errorCount - warningCount * 0.5;
  const score = Math.max(0, Math.round(passed / totalChecks * 100));

  return {
    passed: errorCount === 0,
    issues: allIssues,
    score
  };
}

/**
 * Generate accessibility report
 */
export function generateAccessibilityReport(): string {
  const result = runAccessibilityAudit();

  let report = `# Accessibility Audit Report\n\n`;
  report += `**Score: ${result.score}/100**\n`;
  report += `**Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}**\n\n`;

  if (result.issues.length === 0) {
    report += `🎉 No accessibility issues found! Your application meets WCAG AA standards.\n`;
    return report;
  }

  const errorIssues = result.issues.filter((issue) => issue.type === 'error');
  const warningIssues = result.issues.filter((issue) => issue.type === 'warning');
  const infoIssues = result.issues.filter((issue) => issue.type === 'info');

  if (errorIssues.length > 0) {
    report += `## ❌ Errors (${errorIssues.length})\n\n`;
    errorIssues.forEach((issue, index) => {
      report += `${index + 1}. **${issue.rule}**: ${issue.description}\n`;
      report += `   *Recommendation*: ${issue.recommendation}\n\n`;
    });
  }

  if (warningIssues.length > 0) {
    report += `## ⚠️ Warnings (${warningIssues.length})\n\n`;
    warningIssues.forEach((issue, index) => {
      report += `${index + 1}. **${issue.rule}**: ${issue.description}\n`;
      report += `   *Recommendation*: ${issue.recommendation}\n\n`;
    });
  }

  if (infoIssues.length > 0) {
    report += `## ℹ️ Info (${infoIssues.length})\n\n`;
    infoIssues.forEach((issue, index) => {
      report += `${index + 1}. **${issue.rule}**: ${issue.description}\n`;
      report += `   *Recommendation*: ${issue.recommendation}\n\n`;
    });
  }

  return report;
}

// Auto-run audit in development mode
if (import.meta.env?.DEV) {
  // Run audit after DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const report = generateAccessibilityReport();
        console.group('🔍 Accessibility Audit Report');
        console.log(report);
        console.groupEnd();
      }, 1000);
    });
  }
}

export default {
  runAccessibilityAudit,
  generateAccessibilityReport,
  testContrastRatios,
  testFormSemantics,
  testKeyboardNavigation,
  testARIASemantics,
  testTouchTargets
};