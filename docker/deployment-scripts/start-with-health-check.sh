
#!/bin/bash
set -euo pipefail

# Start nginx in background
nginx -g "daemon off;" &
NGINX_PID=$!

# Health check function
health_check() {
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if curl -f -s http://localhost/health > /dev/null 2>&1; then
            echo "Health check passed"
            return 0
        fi
        
        echo "Health check failed, retry $((retries + 1))/$max_retries"
        retries=$((retries + 1))
        sleep 2
    done
    
    echo "Health check failed after $max_retries attempts"
    return 1
}

# Wait for nginx to start
sleep 5

# Perform initial health check
if ! health_check; then
    echo "Initial health check failed, stopping container"
    kill $NGINX_PID 2>/dev/null || true
    exit 1
fi

echo "Container started successfully with health check"

# Keep the container running and monitor nginx
wait $NGINX_PID
