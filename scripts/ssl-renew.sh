#!/bin/bash

# SSL Certificate Renewal Script
# This script handles certificate renewal with monitoring and fallback

set -e

DOMAIN="${DOMAIN:-nyfashion.example.com}"
LOG_FILE="/var/log/ssl-renewal.log"
BACKUP_DIR="/backup/ssl"
MAX_RETRIES=3
NOTIFICATION_EMAIL="${NOTIFICATION_EMAIL:-admin@nyfashion.example.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "$(date): $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Send notification
send_notification() {
    local subject="$1"
    local message="$2"
    local priority="${3:-normal}"
    
    log "Sending notification: $subject"
    
    # Log the notification
    echo "$(date): NOTIFICATION - $subject: $message" >> "$LOG_FILE"
    
    # Send email if configured
    if command -v mail &> /dev/null && [ -n "$NOTIFICATION_EMAIL" ]; then
        echo "$message" | mail -s "$subject" "$NOTIFICATION_EMAIL" 2>/dev/null || true
    fi
    
    # Send to syslog
    logger -p daemon.info -t ssl-renewal "$subject: $message"
    
    # For critical issues, you might want to integrate with:
    # - Slack webhooks
    # - PagerDuty API
    # - Discord webhooks
    # - SMS services
}

# Backup current certificates
backup_certificates() {
    log "Backing up current certificates..."
    
    mkdir -p "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
    BACKUP_PATH="$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
    
    if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
        cp -r "/etc/letsencrypt/live/$DOMAIN" "$BACKUP_PATH/" || {
            warning "Failed to backup certificates"
            return 1
        }
        success "Certificates backed up to $BACKUP_PATH"
    else
        warning "No certificates found to backup"
    fi
    
    # Clean old backups (keep last 10)
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" | sort -r | tail -n +11 | xargs rm -rf 2>/dev/null || true
}

# Check certificate validity
check_certificate() {
    local cert_file="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    
    if [ ! -f "$cert_file" ]; then
        error "Certificate file not found: $cert_file"
        return 1
    fi
    
    # Get expiration date
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_timestamp=$(date -d "$expiry_date" +%s)
    local current_timestamp=$(date +%s)
    local days_left=$(( (expiry_timestamp - current_timestamp) / 86400 ))
    
    log "Certificate expires in $days_left days ($expiry_date)"
    
    if [ "$days_left" -le 0 ]; then
        error "Certificate has already expired!"
        return 2
    elif [ "$days_left" -le 7 ]; then
        warning "Certificate expires in $days_left days - urgent renewal needed"
        return 3
    elif [ "$days_left" -le 30 ]; then
        log "Certificate expires in $days_left days - renewal recommended"
        return 0
    else
        log "Certificate is valid for $days_left more days"
        return 0
    fi
}

# Test nginx configuration
test_nginx() {
    log "Testing Nginx configuration..."
    
    if nginx -t 2>/dev/null; then
        success "Nginx configuration is valid"
        return 0
    else
        error "Nginx configuration test failed"
        return 1
    fi
}

# Perform certificate renewal
renew_certificate() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log "Certificate renewal attempt $attempt of $MAX_RETRIES"
        
        if certbot renew --quiet --no-self-upgrade 2>/dev/null; then
            success "Certificate renewed successfully on attempt $attempt"
            return 0
        else
            warning "Certificate renewal attempt $attempt failed"
            
            if [ $attempt -eq $MAX_RETRIES ]; then
                error "All renewal attempts failed"
                send_notification "SSL Renewal Failed" \
                    "Certificate renewal for $DOMAIN failed after $MAX_RETRIES attempts. Manual intervention required." \
                    "critical"
                return 1
            fi
            
            sleep 30  # Wait before retry
        fi
        
        ((attempt++))
    done
}

# Force renewal if needed
force_renewal() {
    log "Forcing certificate renewal..."
    
    certbot certonly \
        --webroot \
        --webroot-path="/var/www/html" \
        --domains "$DOMAIN,www.$DOMAIN" \
        --force-renewal \
        --quiet \
        --no-self-upgrade || {
        error "Force renewal failed"
        return 1
    }
    
    success "Force renewal completed"
}

# Reload nginx with new certificates
reload_nginx() {
    log "Reloading Nginx with new certificates..."
    
    if systemctl reload nginx; then
        success "Nginx reloaded successfully"
        return 0
    else
        error "Failed to reload Nginx"
        send_notification "Nginx Reload Failed" \
            "Failed to reload Nginx after SSL certificate renewal for $DOMAIN" \
            "high"
        return 1
    fi
}

# Verify renewed certificate
verify_renewal() {
    log "Verifying renewed certificate..."
    
    # Test HTTPS connection
    if curl -s -I "https://$DOMAIN" >/dev/null 2>&1; then
        success "HTTPS connection test passed"
    else
        error "HTTPS connection test failed"
        return 1
    fi
    
    # Check certificate validity
    local new_expiry=$(openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null 2>/dev/null | \
                       openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
    
    if [ -n "$new_expiry" ]; then
        local days_left=$(( ($(date -d "$new_expiry" +%s) - $(date +%s)) / 86400 ))
        success "New certificate is valid for $days_left days (expires: $new_expiry)"
        
        send_notification "SSL Certificate Renewed" \
            "Certificate for $DOMAIN has been successfully renewed. New expiration: $new_expiry" \
            "normal"
        
        return 0
    else
        error "Could not verify new certificate"
        return 1
    fi
}

# Health check
health_check() {
    log "Performing post-renewal health check..."
    
    local errors=0
    
    # Check SSL certificate
    if ! openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null >/dev/null 2>&1; then
        error "SSL connection test failed"
        ((errors++))
    fi
    
    # Check HSTS header
    if ! curl -s -I "https://$DOMAIN" | grep -q "Strict-Transport-Security"; then
        warning "HSTS header not found"
        ((errors++))
    fi
    
    # Check security headers
    local headers=("X-Frame-Options" "X-Content-Type-Options" "Referrer-Policy")
    for header in "${headers[@]}"; do
        if ! curl -s -I "https://$DOMAIN" | grep -q "$header"; then
            warning "Security header missing: $header"
        fi
    done
    
    # Check application response
    if ! curl -s "https://$DOMAIN" | grep -q "NY FASHION" 2>/dev/null; then
        warning "Application health check failed"
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        success "Health check passed"
        return 0
    else
        warning "Health check completed with $errors issues"
        return 1
    fi
}

# Main renewal process
main() {
    log "Starting SSL certificate renewal process for $DOMAIN"
    
    # Check if we're running as root
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root"
        exit 1
    fi
    
    # Check current certificate
    if ! check_certificate; then
        case $? in
            1) # Certificate not found
                error "Certificate not found - initial setup required"
                exit 1
                ;;
            2) # Certificate expired
                log "Certificate has expired - forcing renewal"
                backup_certificates
                force_renewal || exit 1
                ;;
            3) # Certificate expires soon
                log "Certificate expires soon - proceeding with renewal"
                backup_certificates
                ;;
        esac
    else
        log "Certificate check passed"
        
        # Only renew if within 30 days of expiration
        local cert_file="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
        local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
        local expiry_timestamp=$(date -d "$expiry_date" +%s)
        local current_timestamp=$(date +%s)
        local days_left=$(( (expiry_timestamp - current_timestamp) / 86400 ))
        
        if [ "$days_left" -gt 30 ] && [ "$1" != "--force" ]; then
            log "Certificate is still valid for $days_left days - skipping renewal"
            exit 0
        fi
        
        backup_certificates
    fi
    
    # Test nginx before renewal
    if ! test_nginx; then
        error "Nginx configuration is invalid - aborting renewal"
        exit 1
    fi
    
    # Perform renewal
    if renew_certificate; then
        log "Certificate renewal successful"
    else
        error "Certificate renewal failed"
        exit 1
    fi
    
    # Reload nginx
    if reload_nginx; then
        log "Nginx reload successful"
    else
        error "Nginx reload failed - manual intervention required"
        exit 1
    fi
    
    # Verify the renewal
    if verify_renewal; then
        log "Certificate renewal verification successful"
    else
        warning "Certificate renewal verification failed"
    fi
    
    # Perform health check
    health_check
    
    success "SSL certificate renewal process completed successfully"
    
    log "Renewal process finished at $(date)"
}

# Handle command line arguments
case "${1:-}" in
    --force)
        log "Force renewal requested"
        main --force
        ;;
    --check)
        check_certificate
        exit $?
        ;;
    --test)
        test_nginx && verify_renewal
        ;;
    --help|-h)
        echo "Usage: $0 [--force|--check|--test|--help]"
        echo "  --force   Force certificate renewal even if not needed"
        echo "  --check   Check certificate expiration only"
        echo "  --test    Test nginx config and verify certificate"
        echo "  --help    Show this help message"
        exit 0
        ;;
    "")
        main
        ;;
    *)
        error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac
