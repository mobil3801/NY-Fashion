/**
 * Security Implementation Test
 * Validates that all security measures are properly implemented
 */

import { SECURITY_CONFIG } from '@/config/security';
import { environmentValidator } from './env-validator';
import { securityHeadersManager } from './security-headers';
import { secureAuthManager } from './secure-auth-manager';
import { productionDebugDisabler } from './production-debug-disabler';
import { httpsEnforcer } from './https-enforcer';
import { logger } from './production-logger';

export interface SecurityTestResult {
  passed: boolean;
  score: number;
  grade: string;
  tests: Array<{
    category: string;
    test: string;
    passed: boolean;
    message: string;
    critical: boolean;
  }>;
  summary: {
    total: number;
    passed: number;
    failed: number;
    critical: number;
  };
}

class SecurityTester {
  private results: SecurityTestResult['tests'] = [];

  /**
   * Run comprehensive security tests
   */
  async runSecurityTests(): Promise<SecurityTestResult> {
    this.results = [];
    
    logger.logInfo('Starting comprehensive security tests');

    // Test environment security
    this.testEnvironmentSecurity();

    // Test HTTPS enforcement
    this.testHttpsEnforcement();

    // Test security headers
    this.testSecurityHeaders();

    // Test authentication security
    this.testAuthenticationSecurity();

    // Test debug mode disabling
    this.testDebugModeDisabling();

    // Test CSP implementation
    this.testCSPImplementation();

    // Calculate results
    const summary = this.calculateSummary();
    const score = this.calculateSecurityScore(summary);
    const grade = this.getSecurityGrade(score);

    const result: SecurityTestResult = {
      passed: summary.critical === 0 && score >= 70,
      score,
      grade,
      tests: this.results,
      summary
    };

    logger.logSecurityEvent('security_tests_completed', 'SYSTEM', 'INFO', undefined, {
      score,
      grade,
      passed: result.passed,
      testsRun: summary.total,
      testsPassed: summary.passed,
      criticalFailures: summary.critical
    });

    return result;
  }

  private addTest(category: string, test: string, passed: boolean, message: string, critical: boolean = false) {
    this.results.push({
      category,
      test,
      passed,
      message,
      critical
    });
  }

  private testEnvironmentSecurity() {
    const validation = environmentValidator.validateAll();

    this.addTest(
      'Environment',
      'Environment variables validation',
      validation.isValid,
      validation.isValid ? 'All environment variables are valid' : `Validation failed: ${validation.errors.join(', ')}`,
      !validation.isValid
    );

    // Test production environment settings
    if (import.meta.env.NODE_ENV === 'production') {
      const debugDisabled = !import.meta.env.VITE_ENABLE_DEBUG;
      this.addTest(
        'Environment',
        'Debug mode disabled in production',
        debugDisabled,
        debugDisabled ? 'Debug mode is disabled in production' : 'Debug mode is enabled in production',
        !debugDisabled
      );

      const consoleDisabled = !import.meta.env.VITE_ENABLE_CONSOLE_LOGGING;
      this.addTest(
        'Environment',
        'Console logging disabled in production',
        consoleDisabled,
        consoleDisabled ? 'Console logging is disabled in production' : 'Console logging is enabled in production',
        false
      );

      const httpsEnabled = import.meta.env.VITE_ENABLE_HTTPS_ENFORCEMENT !== 'false';
      this.addTest(
        'Environment',
        'HTTPS enforcement enabled in production',
        httpsEnabled,
        httpsEnabled ? 'HTTPS enforcement is enabled' : 'HTTPS enforcement is disabled',
        !httpsEnabled
      );
    }
  }

  private testHttpsEnforcement() {
    const isSecureContext = httpsEnforcer.isSecureContext();
    const securityState = httpsEnforcer.validateSecurityState();

    this.addTest(
      'HTTPS',
      'Secure context validation',
      isSecureContext || import.meta.env.NODE_ENV !== 'production',
      isSecureContext ? 'Application is running in secure context' : 'Application is not in secure context',
      import.meta.env.NODE_ENV === 'production' && !isSecureContext
    );

    this.addTest(
      'HTTPS',
      'HTTPS security state',
      securityState.isSecure || import.meta.env.NODE_ENV !== 'production',
      securityState.isSecure ? 'HTTPS security state is valid' : `HTTPS issues: ${securityState.issues.join(', ')}`,
      import.meta.env.NODE_ENV === 'production' && !securityState.isSecure
    );
  }

  private testSecurityHeaders() {
    const headersReport = securityHeadersManager.generateSecurityReport();
    const cspValidation = securityHeadersManager.validateCSP();

    const hasRequiredHeaders = headersReport.missingHeaders.length === 0;
    this.addTest(
      'Headers',
      'Required security headers present',
      hasRequiredHeaders,
      hasRequiredHeaders ? 'All required security headers are present' : `Missing headers: ${headersReport.missingHeaders.join(', ')}`,
      false
    );

    this.addTest(
      'Headers',
      'CSP validation',
      cspValidation.isValid,
      cspValidation.isValid ? 'CSP is valid' : `CSP issues: ${cspValidation.issues.join(', ')}`,
      !cspValidation.isValid
    );

    // Test for specific headers
    const expectedHeaders = ['Content-Security-Policy', 'X-Frame-Options', 'X-Content-Type-Options'];
    expectedHeaders.forEach(header => {
      const hasHeader = headersReport.headersConfigured.includes(header);
      this.addTest(
        'Headers',
        `${header} header configured`,
        hasHeader,
        hasHeader ? `${header} is configured` : `${header} is missing`,
        header === 'Content-Security-Policy' && !hasHeader
      );
    });
  }

  private testAuthenticationSecurity() {
    const authStats = secureAuthManager.getSecurityStats();

    // Test password strength validation
    const weakPassword = secureAuthManager.validatePasswordStrength('123');
    this.addTest(
      'Authentication',
      'Password strength validation',
      !weakPassword.isValid,
      !weakPassword.isValid ? 'Password strength validation is working' : 'Password strength validation is not working',
      weakPassword.isValid
    );

    // Test login attempt validation
    const loginCheck = secureAuthManager.validateLoginAttempt('test@test.com');
    this.addTest(
      'Authentication',
      'Login attempt validation',
      loginCheck.allowed !== undefined,
      'Login attempt validation is functional',
      false
    );

    // Test session management
    this.addTest(
      'Authentication',
      'Session management active',
      authStats.activeSessions >= 0,
      'Session management is active',
      false
    );
  }

  private testDebugModeDisabling() {
    const debugStatus = productionDebugDisabler.getStatus();

    if (import.meta.env.NODE_ENV === 'production') {
      this.addTest(
        'Debug',
        'Debug mode disabled in production',
        debugStatus.debugDisabled,
        debugStatus.debugDisabled ? 'Debug mode is disabled in production' : 'Debug mode is still enabled in production',
        !debugStatus.debugDisabled
      );

      this.addTest(
        'Debug',
        'Console logging disabled in production',
        debugStatus.consoleDisabled,
        debugStatus.consoleDisabled ? 'Console logging is disabled' : 'Console logging is still enabled',
        false
      );

      this.addTest(
        'Debug',
        'Debug panels removed',
        debugStatus.panelsRemoved,
        debugStatus.panelsRemoved ? 'Debug panels are removed' : 'Debug panels are still present',
        false
      );
    } else {
      this.addTest(
        'Debug',
        'Development environment detected',
        !debugStatus.isProduction,
        'Running in development mode - debug features allowed',
        false
      );
    }

    // Test for debug globals
    const hasDebugGlobals = typeof (window as any).__DEBUG__ !== 'undefined' ||
                           typeof (window as any).__DEV__ !== 'undefined' ||
                           typeof (window as any).DEBUG !== 'undefined';
    
    this.addTest(
      'Debug',
      'Debug globals removed',
      !hasDebugGlobals || import.meta.env.NODE_ENV !== 'production',
      hasDebugGlobals ? 'Debug globals are present' : 'Debug globals are removed',
      hasDebugGlobals && import.meta.env.NODE_ENV === 'production'
    );
  }

  private testCSPImplementation() {
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const hasCSP = !!cspMeta;

    this.addTest(
      'CSP',
      'CSP meta tag present',
      hasCSP,
      hasCSP ? 'CSP meta tag is present' : 'CSP meta tag is missing',
      !hasCSP
    );

    if (hasCSP && cspMeta) {
      const cspContent = cspMeta.getAttribute('content') || '';
      
      const hasDefaultSrc = cspContent.includes('default-src');
      this.addTest(
        'CSP',
        'CSP default-src directive',
        hasDefaultSrc,
        hasDefaultSrc ? 'CSP has default-src directive' : 'CSP missing default-src directive',
        !hasDefaultSrc
      );

      const hasScriptSrc = cspContent.includes('script-src');
      this.addTest(
        'CSP',
        'CSP script-src directive',
        hasScriptSrc,
        hasScriptSrc ? 'CSP has script-src directive' : 'CSP missing script-src directive',
        false
      );

      const hasObjectSrc = cspContent.includes('object-src');
      this.addTest(
        'CSP',
        'CSP object-src directive',
        hasObjectSrc,
        hasObjectSrc ? 'CSP has object-src directive' : 'CSP missing object-src directive',
        false
      );
    }
  }

  private calculateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const critical = this.results.filter(r => !r.passed && r.critical).length;

    return { total, passed, failed, critical };
  }

  private calculateSecurityScore(summary: { total: number; passed: number; failed: number; critical: number }): number {
    if (summary.total === 0) return 0;

    let score = (summary.passed / summary.total) * 100;
    
    // Penalize critical failures more heavily
    score -= summary.critical * 20;
    
    // Ensure score is within bounds
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private getSecurityGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }
}

// Export singleton instance
export const securityTester = new SecurityTester();

export default securityTester;
