
#!/bin/bash
set -euo pipefail

# Rollback Script for NY Fashion POS System
# This script handles automated rollback procedures

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/rollback_$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Parse command line arguments
DEPLOYMENT_ID=""
TARGET_VERSION=""
ENVIRONMENT="production"
SKIP_VALIDATION=false
EMERGENCY_ROLLBACK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --deployment-id)
            DEPLOYMENT_ID="$2"
            shift 2
            ;;
        --target-version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --emergency)
            EMERGENCY_ROLLBACK=true
            SKIP_VALIDATION=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --deployment-id      Deployment ID to rollback from"
            echo "  --target-version     Target version to rollback to"
            echo "  -e, --environment    Environment (default: production)"
            echo "  --skip-validation    Skip pre-rollback validation"
            echo "  --emergency          Emergency rollback mode"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$DEPLOYMENT_ID" && -z "$TARGET_VERSION" ]]; then
    error "Either --deployment-id or --target-version must be specified"
    exit 1
fi

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Start rollback process
log "Starting rollback process"
log "Deployment ID: ${DEPLOYMENT_ID:-N/A}"
log "Target Version: ${TARGET_VERSION:-latest-stable}"
log "Environment: $ENVIRONMENT"
log "Emergency Mode: $EMERGENCY_ROLLBACK"

# Pre-rollback validation
pre_rollback_validation() {
    if [[ "$SKIP_VALIDATION" == true ]]; then
        warning "Skipping pre-rollback validation"
        return 0
    fi

    log "Running pre-rollback validation..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running"
        return 1
    fi
    
    # Check current system status
    log "Checking current system status..."
    local current_containers=$(docker ps -q --filter "name=nyfashion-")
    if [[ -z "$current_containers" ]]; then
        warning "No running application containers found"
    fi
    
    # Verify target version availability
    if [[ -n "$TARGET_VERSION" ]]; then
        log "Verifying target version availability: $TARGET_VERSION"
        if ! docker images | grep -q "$TARGET_VERSION"; then
            warning "Target version $TARGET_VERSION not found in local images"
            log "Attempting to pull target version..."
            if ! docker pull "nyfashion:$TARGET_VERSION" 2>/dev/null; then
                error "Failed to pull target version $TARGET_VERSION"
                return 1
            fi
        fi
    fi
    
    # Check disk space
    local available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 1048576 ]]; then # 1GB in KB
        error "Insufficient disk space for rollback"
        return 1
    fi
    
    success "Pre-rollback validation passed"
    return 0
}

# Create rollback point
create_rollback_point() {
    log "Creating rollback point..."
    
    # Export current container configurations
    local rollback_point_dir="$PROJECT_ROOT/rollback_points/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$rollback_point_dir"
    
    # Save current docker-compose state
    if [[ -f "$PROJECT_ROOT/docker-compose.deployment.yml" ]]; then
        cp "$PROJECT_ROOT/docker-compose.deployment.yml" "$rollback_point_dir/"
    fi
    
    # Save current container images
    docker images --format "{{.Repository}}:{{.Tag}}" | grep "nyfashion" > "$rollback_point_dir/images.txt" || true
    
    # Save current environment configuration
    env | grep -E "^(NODE_ENV|DATABASE_URL|REDIS_URL)" > "$rollback_point_dir/environment.txt" || true
    
    success "Rollback point created at $rollback_point_dir"
    echo "$rollback_point_dir" > "$PROJECT_ROOT/.last_rollback_point"
    
    return 0
}

# Execute blue-green rollback
blue_green_rollback() {
    log "Executing blue-green rollback..."
    
    # Determine current active slot
    local current_blue_status=$(docker ps --filter "name=nyfashion-blue" --format "{{.Status}}")
    local current_green_status=$(docker ps --filter "name=nyfashion-green" --format "{{.Status}}")
    
    local active_slot="unknown"
    local inactive_slot="unknown"
    
    if [[ -n "$current_blue_status" && -z "$current_green_status" ]]; then
        active_slot="blue"
        inactive_slot="green"
    elif [[ -n "$current_green_status" && -z "$current_blue_status" ]]; then
        active_slot="green"
        inactive_slot="blue"
    else
        warning "Could not determine active slot, defaulting to blue as active"
        active_slot="blue"
        inactive_slot="green"
    fi
    
    log "Current active slot: $active_slot"
    log "Target rollback slot: $inactive_slot"
    
    # Start the inactive slot with target version
    log "Starting $inactive_slot slot with target version..."
    
    if [[ -n "$TARGET_VERSION" ]]; then
        # Update docker-compose to use target version
        sed -i.bak "s|nyfashion:.*|nyfashion:$TARGET_VERSION|g" "$PROJECT_ROOT/docker-compose.deployment.yml"
    fi
    
    if ! docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" up -d "app-$inactive_slot"; then
        error "Failed to start $inactive_slot slot"
        return 1
    fi
    
    # Wait for the new slot to be ready
    log "Waiting for $inactive_slot slot to be healthy..."
    local retries=0
    local max_retries=30
    local port=3002
    
    if [[ "$inactive_slot" == "blue" ]]; then
        port=3001
    fi
    
    while [ $retries -lt $max_retries ]; do
        if curl -f -s "http://localhost:$port/health" > /dev/null 2>&1; then
            success "$inactive_slot slot is healthy"
            break
        fi
        
        log "Health check failed for $inactive_slot slot, retry $((retries + 1))/$max_retries"
        retries=$((retries + 1))
        sleep 5
    done
    
    if [ $retries -eq $max_retries ]; then
        error "Health check failed for $inactive_slot slot after $max_retries attempts"
        return 1
    fi
    
    # Switch traffic to the rolled back version
    log "Switching traffic to $inactive_slot slot..."
    
    # Update load balancer configuration or just stop the old slot
    # For simplicity, we'll stop the old slot after a grace period
    sleep 10
    
    log "Stopping $active_slot slot..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" stop "app-$active_slot"
    
    success "Blue-green rollback completed successfully"
    log "New active slot: $inactive_slot"
    
    return 0
}

# Execute emergency rollback
emergency_rollback() {
    log "Executing emergency rollback..."
    
    # Stop all services immediately
    log "Stopping all services..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" down --remove-orphans
    
    # Restore from last known good configuration
    local last_rollback_point=""
    if [[ -f "$PROJECT_ROOT/.last_rollback_point" ]]; then
        last_rollback_point=$(cat "$PROJECT_ROOT/.last_rollback_point")
    fi
    
    if [[ -n "$last_rollback_point" && -d "$last_rollback_point" ]]; then
        log "Restoring from last rollback point: $last_rollback_point"
        
        # Restore docker-compose configuration
        if [[ -f "$last_rollback_point/docker-compose.deployment.yml" ]]; then
            cp "$last_rollback_point/docker-compose.deployment.yml" "$PROJECT_ROOT/"
        fi
        
        # Restore environment variables
        if [[ -f "$last_rollback_point/environment.txt" ]]; then
            while IFS= read -r line; do
                export "$line"
            done < "$last_rollback_point/environment.txt"
        fi
    else
        warning "No rollback point found, using default configuration"
    fi
    
    # Start services with last known good configuration
    log "Starting services with emergency configuration..."
    if ! docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" up -d; then
        error "Failed to start services in emergency rollback"
        return 1
    fi
    
    success "Emergency rollback completed"
    return 0
}

# Post-rollback verification
post_rollback_verification() {
    log "Running post-rollback verification..."
    
    # Wait for services to be fully ready
    sleep 30
    
    # Health check
    local health_check_passed=false
    local retries=0
    local max_retries=10
    
    while [ $retries -lt $max_retries ]; do
        if curl -f -s "http://localhost/health" > /dev/null 2>&1; then
            health_check_passed=true
            break
        fi
        
        log "Health check failed, retry $((retries + 1))/$max_retries"
        retries=$((retries + 1))
        sleep 10
    done
    
    if [[ "$health_check_passed" != true ]]; then
        error "Post-rollback health check failed"
        return 1
    fi
    
    # Basic functionality test
    log "Running basic functionality tests..."
    
    # Test API endpoints
    if ! curl -f -s "http://localhost/api/health" > /dev/null 2>&1; then
        warning "API health endpoint check failed"
    fi
    
    # Test database connectivity
    # This would need to be implemented based on your specific setup
    
    success "Post-rollback verification completed successfully"
    return 0
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Rollback failed with exit code: $exit_code"
        log "Check the rollback logs at: $LOG_FILE"
        
        # Attempt to restore previous state if possible
        if [[ -f "$PROJECT_ROOT/.last_rollback_point" ]]; then
            local last_point=$(cat "$PROJECT_ROOT/.last_rollback_point")
            warning "Consider manual restoration from: $last_point"
        fi
    else
        success "Rollback completed successfully"
        log "Rollback logs available at: $LOG_FILE"
    fi
    exit $exit_code
}

# Set trap for cleanup
trap cleanup EXIT

# Main rollback execution
main() {
    local exit_code=0
    
    # Pre-rollback validation
    if ! pre_rollback_validation; then
        exit_code=1
        error "Pre-rollback validation failed"
        return $exit_code
    fi
    
    # Create rollback point
    if ! create_rollback_point; then
        exit_code=1
        error "Failed to create rollback point"
        return $exit_code
    fi
    
    # Execute appropriate rollback strategy
    if [[ "$EMERGENCY_ROLLBACK" == true ]]; then
        if ! emergency_rollback; then
            exit_code=1
            error "Emergency rollback failed"
            return $exit_code
        fi
    else
        if ! blue_green_rollback; then
            exit_code=1
            error "Blue-green rollback failed"
            return $exit_code
        fi
    fi
    
    # Post-rollback verification
    if ! post_rollback_verification; then
        exit_code=1
        error "Post-rollback verification failed"
        return $exit_code
    fi
    
    success "Rollback completed successfully!"
    log "Environment: $ENVIRONMENT"
    log "Target Version: ${TARGET_VERSION:-previous-version}"
    log "Rollback Mode: $([[ "$EMERGENCY_ROLLBACK" == true ]] && echo "Emergency" || echo "Standard")"
    
    return $exit_code
}

# Run main rollback process
main
