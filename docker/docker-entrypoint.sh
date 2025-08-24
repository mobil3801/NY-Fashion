#!/bin/sh
set -e

# Docker entrypoint script for advanced configuration
# This script can be used for runtime configuration

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

# Environment-specific setup
if [ "$NODE_ENV" = "development" ]; then
    log "Starting in development mode"
    
    # Development-specific setup
    if [ ! -d "node_modules" ]; then
        log "Installing development dependencies..."
        npm install
    fi
    
elif [ "$NODE_ENV" = "production" ]; then
    log "Starting in production mode"
    
    # Production-specific setup
    # You can add production-specific initialization here
fi

# Health check function
health_check() {
    if [ "$NODE_ENV" = "development" ]; then
        wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
    else
        wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1
    fi
}

# Handle special commands
case "$1" in
    "health")
        health_check
        ;;
    "dev")
        npm run dev
        ;;
    "build")
        npm run build
        ;;
    "start")
        if [ "$NODE_ENV" = "development" ]; then
            npm run dev
        else
            nginx -g "daemon off;"
        fi
        ;;
    *)
        # Execute the provided command
        exec "$@"
        ;;
esac
