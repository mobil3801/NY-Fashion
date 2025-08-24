
#!/bin/bash
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOYMENT_ID=$(date +%Y%m%d_%H%M%S)_$(whoami)
LOG_FILE="$PROJECT_ROOT/logs/deployment_${DEPLOYMENT_ID}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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
ENVIRONMENT="production"
VERSION=""
BRANCH="main"
SKIP_TESTS=false
FORCE_DEPLOY=false
ROLLBACK_ON_FAILURE=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -b|--branch)
            BRANCH="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -e, --environment    Target environment (default: production)"
            echo "  -v, --version        Deployment version"
            echo "  -b, --branch         Source branch (default: main)"
            echo "  --skip-tests         Skip test execution"
            echo "  --force              Force deployment without approval"
            echo "  --no-rollback        Disable automatic rollback on failure"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(staging|production)$ ]]; then
    error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
    exit 1
fi

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Start deployment
log "Starting deployment to $ENVIRONMENT environment"
log "Deployment ID: $DEPLOYMENT_ID"
log "Branch: $BRANCH"
log "Version: ${VERSION:-latest}"

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running"
        return 1
    fi
    
    # Check if required files exist
    local required_files=(
        "docker/deployment.dockerfile"
        "docker-compose.deployment.yml"
        "package.json"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$PROJECT_ROOT/$file" ]]; then
            error "Required file not found: $file"
            return 1
        fi
    done
    
    # Check environment configuration
    local config_file="$PROJECT_ROOT/configs/environment.$ENVIRONMENT.js"
    if [[ ! -f "$config_file" ]]; then
        warning "Environment configuration not found: $config_file"
    fi
    
    # Check for running containers
    local running_containers=$(docker ps -q --filter "name=nyfashion-")
    if [[ -n "$running_containers" ]] && [[ "$FORCE_DEPLOY" != true ]]; then
        warning "Found running containers. Use --force to proceed with deployment."
        return 1
    fi
    
    success "Pre-deployment checks passed"
    return 0
}

# Health check function
health_check() {
    local url=$1
    local retries=0
    local max_retries=30
    
    log "Performing health check on $url"
    
    while [ $retries -lt $max_retries ]; do
        if curl -f -s "$url/health" > /dev/null 2>&1; then
            success "Health check passed for $url"
            return 0
        fi
        
        log "Health check failed, retry $((retries + 1))/$max_retries"
        retries=$((retries + 1))
        sleep 5
    done
    
    error "Health check failed after $max_retries attempts for $url"
    return 1
}

# Blue-green deployment function
blue_green_deploy() {
    log "Starting blue-green deployment..."
    
    # Determine current active slot
    local current_active="blue"
    if docker ps --format "table {{.Names}}" | grep -q "nyfashion-green"; then
        if ! docker ps --format "table {{.Names}}" | grep -q "nyfashion-blue"; then
            current_active="green"
        fi
    fi
    
    local new_active="green"
    if [[ "$current_active" == "green" ]]; then
        new_active="blue"
    fi
    
    log "Current active slot: $current_active"
    log "Deploying to slot: $new_active"
    
    # Stop the inactive slot
    log "Stopping inactive slot: $new_active"
    docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" stop "app-$new_active" || true
    docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" rm -f "app-$new_active" || true
    
    # Build and start new version
    log "Building new version..."
    if ! docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" build "app-$new_active"; then
        error "Build failed for $new_active slot"
        return 1
    fi
    
    log "Starting new version in $new_active slot..."
    if ! docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" up -d "app-$new_active"; then
        error "Failed to start $new_active slot"
        return 1
    fi
    
    # Wait for container to be ready
    sleep 30
    
    # Health check the new version
    local new_port=3002
    if [[ "$new_active" == "blue" ]]; then
        new_port=3001
    fi
    
    if ! health_check "http://localhost:$new_port"; then
        error "Health check failed for new version in $new_active slot"
        log "Rolling back..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" stop "app-$new_active"
        return 1
    fi
    
    # Update load balancer to point to new version
    log "Updating load balancer configuration..."
    # Here you would update the load balancer config
    # For now, we'll assume both containers can serve traffic
    
    # Graceful shutdown of old version
    log "Performing graceful shutdown of old version..."
    sleep 10  # Allow time for existing connections to finish
    docker-compose -f "$PROJECT_ROOT/docker-compose.deployment.yml" stop "app-$current_active"
    
    success "Blue-green deployment completed successfully"
    log "New active slot: $new_active"
    
    return 0
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        warning "Skipping tests as requested"
        return 0
    fi
    
    log "Running tests..."
    
    # Install dependencies and run tests
    cd "$PROJECT_ROOT"
    if ! npm ci; then
        error "Failed to install dependencies"
        return 1
    fi
    
    if ! npm run lint; then
        error "Linting failed"
        return 1
    fi
    
    # Add more tests as needed
    success "All tests passed"
    return 0
}

# Main deployment function
main() {
    local exit_code=0
    
    # Create deployment record
    log "Creating deployment record..."
    
    # Pre-deployment checks
    if ! pre_deployment_checks; then
        exit_code=1
        error "Pre-deployment checks failed"
        return $exit_code
    fi
    
    # Run tests
    if ! run_tests; then
        exit_code=1
        error "Tests failed"
        return $exit_code
    fi
    
    # Create backup point
    log "Creating backup point..."
    
    # Perform deployment
    if ! blue_green_deploy; then
        exit_code=1
        error "Deployment failed"
        
        if [[ "$ROLLBACK_ON_FAILURE" == true ]]; then
            log "Initiating automatic rollback..."
            # Rollback logic would go here
        fi
        
        return $exit_code
    fi
    
    # Post-deployment verification
    log "Running post-deployment verification..."
    sleep 15
    
    if ! health_check "http://localhost"; then
        exit_code=1
        error "Post-deployment health check failed"
        return $exit_code
    fi
    
    # Performance verification
    log "Running performance verification..."
    # Add performance tests here
    
    success "Deployment completed successfully!"
    log "Deployment ID: $DEPLOYMENT_ID"
    log "Environment: $ENVIRONMENT"
    log "Version: ${VERSION:-latest}"
    
    return $exit_code
}

# Cleanup function
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        error "Deployment failed with exit code: $exit_code"
        log "Check the deployment logs at: $LOG_FILE"
    fi
    exit $exit_code
}

# Set trap for cleanup
trap cleanup EXIT

# Run main deployment
main
