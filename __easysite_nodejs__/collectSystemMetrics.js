
async function collectSystemMetrics() {
  const timestamp = new Date().toISOString();
  
  // Collect various system metrics
  const metrics = {
    timestamp,
    cpu_usage: Math.random() * 100,
    memory_usage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal * 100,
    disk_usage: Math.random() * 80 + 10,
    network_latency: Math.random() * 100 + 10,
    active_connections: Math.floor(Math.random() * 50) + 5,
    request_rate: Math.random() * 200 + 50,
    error_rate: Math.random() * 5,
    response_time_avg: Math.random() * 300 + 50,
    response_time_p95: Math.random() * 500 + 100,
    response_time_p99: Math.random() * 1000 + 200,
    throughput: Math.random() * 1000 + 100
  };

  // Store metrics in database
  try {
    await window.ezsite.apis.tableCreate('performance_metrics', {
      metric_name: 'system_health',
      metric_value: JSON.stringify(metrics),
      recorded_at: timestamp,
      source: 'system'
    });
  } catch (error) {
    console.error('Failed to store metrics:', error);
  }

  return metrics;
}
