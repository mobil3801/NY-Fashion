
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const crypto = require('crypto');

async function performSecurityHealthCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    checks: {},
    recommendations: [],
    criticalIssues: []
  };

  try {
    // SSL Certificate Check
    results.checks.ssl = await checkSSLCertificate();
    
    // Security Headers Check
    results.checks.headers = await checkSecurityHeaders();
    
    // File Permissions Check
    results.checks.permissions = await checkFilePermissions();
    
    // Dependencies Security Check
    results.checks.dependencies = await checkDependenciesSecurity();
    
    // Configuration Security Check
    results.checks.configuration = await checkSecurityConfiguration();
    
    // Log Analysis
    results.checks.logs = await analyzeLogs();

    // Determine overall health
    const hasErrors = Object.values(results.checks).some(check => 
      check.status === 'error' || check.status === 'critical'
    );
    
    const hasWarnings = Object.values(results.checks).some(check => 
      check.status === 'warning'
    );

    if (hasErrors) {
      results.overall = 'unhealthy';
    } else if (hasWarnings) {
      results.overall = 'degraded';
    }

    // Collect recommendations and critical issues
    Object.values(results.checks).forEach(check => {
      if (check.recommendations) {
        results.recommendations.push(...check.recommendations);
      }
      if (check.status === 'critical' || check.status === 'error') {
        results.criticalIssues.push({
          check: check.name,
          issue: check.message,
          recommendation: check.recommendation
        });
      }
    });

  } catch (error) {
    results.overall = 'error';
    results.error = error.message;
  }

  return results;
}

async function checkSSLCertificate() {
  return new Promise((resolve) => {
    const domain = process.env.DOMAIN || 'localhost';
    
    if (domain === 'localhost') {
      resolve({
        name: 'SSL Certificate',
        status: 'warning',
        message: 'Running on localhost - SSL check skipped',
        recommendation: 'Configure SSL certificate for production'
      });
      return;
    }

    const options = {
      hostname: domain,
      port: 443,
      method: 'GET',
      timeout: 5000
    };

    const req = https.request(options, (res) => {
      const cert = res.connection.getPeerCertificate();
      
      if (!cert || !cert.valid_from) {
        resolve({
          name: 'SSL Certificate',
          status: 'error',
          message: 'No valid SSL certificate found',
          recommendation: 'Install and configure SSL certificate'
        });
        return;
      }

      const now = new Date();
      const expiry = new Date(cert.valid_to);
      const daysUntilExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));

      let status = 'healthy';
      let message = `Certificate valid until ${cert.valid_to}`;
      const recommendations = [];

      if (daysUntilExpiry <= 0) {
        status = 'critical';
        message = 'Certificate has expired!';
        recommendations.push('Renew SSL certificate immediately');
      } else if (daysUntilExpiry <= 7) {
        status = 'error';
        message = `Certificate expires in ${daysUntilExpiry} days`;
        recommendations.push('Renew SSL certificate urgently');
      } else if (daysUntilExpiry <= 30) {
        status = 'warning';
        message = `Certificate expires in ${daysUntilExpiry} days`;
        recommendations.push('Plan SSL certificate renewal');
      }

      resolve({
        name: 'SSL Certificate',
        status,
        message,
        daysUntilExpiry,
        issuer: cert.issuer?.CN,
        subject: cert.subject?.CN,
        recommendations
      });
    });

    req.on('error', () => {
      resolve({
        name: 'SSL Certificate',
        status: 'error',
        message: 'Unable to check SSL certificate',
        recommendation: 'Verify SSL configuration'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: 'SSL Certificate',
        status: 'error',
        message: 'SSL certificate check timed out',
        recommendation: 'Check network connectivity and SSL configuration'
      });
    });

    req.end();
  });
}

async function checkSecurityHeaders() {
  const requiredHeaders = [
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Content-Security-Policy',
    'Referrer-Policy'
  ];

  const domain = process.env.DOMAIN || 'localhost';
  const protocol = domain === 'localhost' ? 'http' : 'https';
  const port = domain === 'localhost' ? '8080' : '443';

  return new Promise((resolve) => {
    const module = protocol === 'https' ? require('https') : require('http');
    
    const options = {
      hostname: domain,
      port: protocol === 'https' ? 443 : 8080,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    };

    const req = module.request(options, (res) => {
      const presentHeaders = [];
      const missingHeaders = [];

      requiredHeaders.forEach(header => {
        if (res.headers[header.toLowerCase()]) {
          presentHeaders.push(header);
        } else {
          missingHeaders.push(header);
        }
      });

      let status = 'healthy';
      let message = 'All security headers present';
      const recommendations = [];

      if (missingHeaders.length > 0) {
        status = missingHeaders.length > 2 ? 'error' : 'warning';
        message = `Missing ${missingHeaders.length} security headers`;
        recommendations.push(`Add missing headers: ${missingHeaders.join(', ')}`);
      }

      resolve({
        name: 'Security Headers',
        status,
        message,
        presentHeaders,
        missingHeaders,
        recommendations
      });
    });

    req.on('error', () => {
      resolve({
        name: 'Security Headers',
        status: 'error',
        message: 'Unable to check security headers',
        recommendation: 'Verify application is running and accessible'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        name: 'Security Headers',
        status: 'error',
        message: 'Security headers check timed out',
        recommendation: 'Check application responsiveness'
      });
    });

    req.end();
  });
}

async function checkFilePermissions() {
  const criticalFiles = [
    'package.json',
    'src/config/security.ts',
    '.env',
    'scripts/ssl-setup.sh',
    'scripts/ssl-renew.sh'
  ];

  const issues = [];
  const checked = [];

  for (const file of criticalFiles) {
    try {
      const stats = await fs.stat(file);
      const mode = stats.mode & parseInt('777', 8);
      
      checked.push({
        file,
        permissions: mode.toString(8),
        readable: !!(mode & parseInt('444', 8)),
        writable: !!(mode & parseInt('222', 8)),
        executable: !!(mode & parseInt('111', 8))
      });

      // Check for overly permissive permissions
      if (file.endsWith('.sh') && (mode & parseInt('022', 8))) {
        issues.push(`${file} has write permissions for group/others`);
      }
      
      if (file === '.env' && (mode & parseInt('044', 8))) {
        issues.push(`${file} is readable by group/others`);
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        issues.push(`Cannot check permissions for ${file}: ${error.message}`);
      }
    }
  }

  return {
    name: 'File Permissions',
    status: issues.length > 0 ? 'warning' : 'healthy',
    message: issues.length > 0 ? `${issues.length} permission issues found` : 'File permissions are secure',
    issues,
    checked,
    recommendations: issues.length > 0 ? ['Review and fix file permissions'] : []
  };
}

async function checkDependenciesSecurity() {
  try {
    const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // In a real implementation, you would check against vulnerability databases
    // For now, we'll do basic checks
    const vulnerablePackages = [];
    const outdatedPackages = [];
    
    // Check for known vulnerable patterns
    Object.entries(dependencies).forEach(([name, version]) => {
      // This is a simplified check - in production, use npm audit or similar
      if (typeof version === 'string' && version.includes('^0.')) {
        outdatedPackages.push({ name, version, issue: 'Major version 0' });
      }
    });

    let status = 'healthy';
    let message = 'No obvious dependency issues found';
    const recommendations = [];

    if (vulnerablePackages.length > 0) {
      status = 'error';
      message = `${vulnerablePackages.length} vulnerable packages found`;
      recommendations.push('Update vulnerable packages immediately');
    } else if (outdatedPackages.length > 0) {
      status = 'warning';
      message = `${outdatedPackages.length} potentially outdated packages`;
      recommendations.push('Review and update dependencies');
    }

    return {
      name: 'Dependencies Security',
      status,
      message,
      vulnerablePackages,
      outdatedPackages,
      totalDependencies: Object.keys(dependencies).length,
      recommendations
    };

  } catch (error) {
    return {
      name: 'Dependencies Security',
      status: 'error',
      message: `Cannot analyze dependencies: ${error.message}`,
      recommendation: 'Verify package.json exists and is readable'
    };
  }
}

async function checkSecurityConfiguration() {
  const issues = [];
  const configs = [];

  // Check environment variables
  const securityEnvVars = [
    'NODE_ENV',
    'CSP_ENABLED',
    'RATE_LIMIT_ENABLED',
    'NOTIFICATION_EMAIL'
  ];

  securityEnvVars.forEach(varName => {
    const value = process.env[varName];
    configs.push({
      name: varName,
      set: !!value,
      value: varName === 'NOTIFICATION_EMAIL' ? (value ? '[SET]' : undefined) : value
    });

    if (!value && ['NODE_ENV'].includes(varName)) {
      issues.push(`Missing critical environment variable: ${varName}`);
    }
  });

  // Check if running in production mode
  if (process.env.NODE_ENV !== 'production') {
    issues.push('Not running in production mode');
  }

  return {
    name: 'Security Configuration',
    status: issues.length > 0 ? (issues.length > 2 ? 'error' : 'warning') : 'healthy',
    message: issues.length > 0 ? `${issues.length} configuration issues found` : 'Configuration is secure',
    issues,
    configs,
    recommendations: issues.length > 0 ? ['Review and fix configuration issues'] : []
  };
}

async function analyzeLogs() {
  const logFiles = [
    '/var/log/ssl-setup.log',
    '/var/log/ssl-renewal.log',
    '/var/log/ssl-monitor.log'
  ];

  const analysis = {
    errors: 0,
    warnings: 0,
    recentEvents: [],
    oldestLog: null,
    newestLog: null
  };

  for (const logFile of logFiles) {
    try {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      lines.forEach(line => {
        if (line.includes('ERROR') || line.includes('FAILED')) {
          analysis.errors++;
          analysis.recentEvents.push({ type: 'error', message: line.substring(0, 100) });
        } else if (line.includes('WARNING') || line.includes('WARN')) {
          analysis.warnings++;
          analysis.recentEvents.push({ type: 'warning', message: line.substring(0, 100) });
        }
      });

    } catch (error) {
      // Log file doesn't exist or can't be read - this is expected in many cases
    }
  }

  // Keep only recent events
  analysis.recentEvents = analysis.recentEvents.slice(-10);

  let status = 'healthy';
  let message = 'Log analysis completed';
  const recommendations = [];

  if (analysis.errors > 10) {
    status = 'error';
    message = `${analysis.errors} errors found in logs`;
    recommendations.push('Investigate and resolve log errors');
  } else if (analysis.errors > 0 || analysis.warnings > 20) {
    status = 'warning';
    message = `${analysis.errors} errors and ${analysis.warnings} warnings in logs`;
    recommendations.push('Review log warnings and errors');
  }

  return {
    name: 'Log Analysis',
    status,
    message,
    ...analysis,
    recommendations
  };
}

module.exports = performSecurityHealthCheck;
