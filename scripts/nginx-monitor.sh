#!/bin/bash
# Nginx Monitoring Script for NY Fashion POS
# Monitors Nginx status, SSL certificates, and performance

set -e

# Configuration
DOMAIN="nyfashion.com"
LOG_FILE="/var/log/nginx-monitor.log"
ALERT_EMAIL="admin@nyfashion.com"
SLACK_WEBHOOK_URL="" # Optional: Add your Slack webhook URL

# Thresholds
MAX_RESPONSE_TIME=5000  # milliseconds
MIN_SSL_DAYS=30
MAX_ERROR_RATE=5        # percentage

# Function to log messages
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Function to send alert
send_alert() {
    local message="$1"
    local level="$2"  # INFO, WARNING, ERROR
    
    log_message "[$level] $message"
    
    # Email alert
    if command -v mail &> /dev/null && [ -n "$ALERT_EMAIL" ]; then
        echo "$message" | mail -s "NY Fashion POS Alert [$level]" "$ALERT_EMAIL"
    fi
    
    # Slack alert (if configured)
    if [ -n "$SLACK_WEBHOOK_URL" ] && [ "$level" != "INFO" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 NY Fashion POS Alert [$level]: $message\"}" \
            "$SLACK_WEBHOOK_URL" &>/dev/null || true
    fi
}

# Check Nginx status
check_nginx_status() {
    if ! systemctl is-active --quiet nginx; then
        send_alert "Nginx service is not running!" "ERROR"
        return 1
    fi
    
    log_message "✅ Nginx service is running"
    return 0
}

# Check website response
check_website_response() {
    local start_time=$(date +%s%3N)
    local response_code
    
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN/health" || echo "000")
    local end_time=$(date +%s%3N)
    local response_time=$((end_time - start_time))
    
    if [ "$response_code" != "200" ]; then
        send_alert "Website is not responding correctly (HTTP $response_code)" "ERROR"
        return 1
    fi
    
    if [ "$response_time" -gt "$MAX_RESPONSE_TIME" ]; then
        send_alert "Website response time is slow: ${response_time}ms (threshold: ${MAX_RESPONSE_TIME}ms)" "WARNING"
    fi
    
    log_message "✅ Website responding correctly (${response_time}ms)"
    return 0
}

# Check SSL certificate
check_ssl_certificate() {
    local cert_file="/etc/letsencrypt/live/$DOMAIN/cert.pem"
    
    if [ ! -f "$cert_file" ]; then
        send_alert "SSL certificate file not found: $cert_file" "ERROR"
        return 1
    fi
    
    local expiry_date
    expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch
    current_epoch=$(date +%s)
    local days_until_expiry
    days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    if [ "$days_until_expiry" -lt 0 ]; then
        send_alert "SSL certificate has expired!" "ERROR"
        return 1
    elif [ "$days_until_expiry" -lt "$MIN_SSL_DAYS" ]; then
        send_alert "SSL certificate expires in $days_until_expiry days" "WARNING"
    fi
    
    log_message "✅ SSL certificate valid (expires in $days_until_expiry days)"
    return 0
}

# Check error rate
check_error_rate() {
    local access_log="/var/log/nginx/nyfashion_access.log"
    
    if [ ! -f "$access_log" ]; then
        log_message "ℹ️  Access log not found: $access_log"
        return 0
    fi
    
    # Check last 1000 requests
    local total_requests
    total_requests=$(tail -n 1000 "$access_log" | wc -l)
    
    if [ "$total_requests" -eq 0 ]; then
        log_message "ℹ️  No recent requests found"
        return 0
    fi
    
    local error_requests
    error_requests=$(tail -n 1000 "$access_log" | grep -E ' (4[0-9][0-9]|5[0-9][0-9]) ' | wc -l)
    local error_rate
    error_rate=$((error_requests * 100 / total_requests))
    
    if [ "$error_rate" -gt "$MAX_ERROR_RATE" ]; then
        send_alert "High error rate detected: ${error_rate}% (${error_requests}/${total_requests} requests)" "WARNING"
    fi
    
    log_message "✅ Error rate: ${error_rate}% (${error_requests}/${total_requests} requests)"
    return 0
}

# Check disk space
check_disk_space() {
    local usage
    usage=$(df /var/log | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$usage" -gt 90 ]; then
        send_alert "Log partition disk usage is high: ${usage}%" "WARNING"
    elif [ "$usage" -gt 95 ]; then
        send_alert "Log partition disk usage is critical: ${usage}%" "ERROR"
    fi
    
    log_message "✅ Disk usage: ${usage}%"
    return 0
}

# Main monitoring function
main() {
    log_message "🔍 Starting Nginx monitoring check..."
    
    local exit_code=0
    
    check_nginx_status || exit_code=1
    check_website_response || exit_code=1
    check_ssl_certificate || exit_code=1
    check_error_rate || exit_code=1
    check_disk_space || exit_code=1
    
    if [ $exit_code -eq 0 ]; then
        log_message "✅ All checks passed"
    else
        log_message "❌ Some checks failed"
    fi
    
    log_message "🏁 Monitoring check completed"
    return $exit_code
}

# Run main function
main "$@"