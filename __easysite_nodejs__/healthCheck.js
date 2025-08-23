
function healthCheck() {
  // Simple health check endpoint
  // Returns basic system status and timestamp
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'NY FASHION POS',
    version: '1.0.0',
    uptime: process.uptime()
  };
}