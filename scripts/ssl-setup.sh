#!/bin/bash

# SSL Certificate Setup Script with Let's Encrypt
# This script sets up SSL certificates for NY Fashion POS system

set -e

# Configuration
DOMAIN="${DOMAIN:-nyfashion.example.com}"
EMAIL="${EMAIL:-admin@nyfashion.example.com}"
NGINX_CONFIG_DIR="/etc/nginx"
SSL_DIR="/etc/letsencrypt"
WEBROOT="/var/www/html"
LOG_FILE="/var/log/ssl-setup.log"

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
    exit 1
}

success() {
    echo -e "${GREEN}SUCCESS: $1${NC}" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root"
    fi
}

# Install required packages
install_dependencies() {
    log "Installing dependencies..."
    
    apt-get update
    apt-get install -y certbot python3-certbot-nginx nginx curl
    
    success "Dependencies installed successfully"
}

# Create nginx configuration for HTTP challenge
create_nginx_config() {
    log "Creating initial Nginx configuration..."
    
    cat > "$NGINX_CONFIG_DIR/sites-available/nyfashion" << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root $WEBROOT;
        try_files \$uri =404;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

    # Enable the site
    ln -sf "$NGINX_CONFIG_DIR/sites-available/nyfashion" "$NGINX_CONFIG_DIR/sites-enabled/"
    rm -f "$NGINX_CONFIG_DIR/sites-enabled/default"
    
    # Create webroot directory
    mkdir -p "$WEBROOT/.well-known/acme-challenge"
    chown -R www-data:www-data "$WEBROOT"
    
    # Test nginx configuration
    nginx -t || error "Nginx configuration test failed"
    systemctl reload nginx || error "Failed to reload Nginx"
    
    success "Nginx configuration created and loaded"
}

# Obtain SSL certificate
obtain_certificate() {
    log "Obtaining SSL certificate from Let's Encrypt..."
    
    certbot certonly \
        --webroot \
        --webroot-path="$WEBROOT" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --domains "$DOMAIN,www.$DOMAIN" \
        --non-interactive || error "Failed to obtain SSL certificate"
    
    success "SSL certificate obtained successfully"
}

# Create secure nginx configuration with SSL
create_ssl_config() {
    log "Creating secure Nginx configuration with SSL..."
    
    cat > "$NGINX_CONFIG_DIR/sites-available/nyfashion" << EOF
# HTTP server - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Allow Let's Encrypt challenges
    location /.well-known/acme-challenge/ {
        root $WEBROOT;
        try_files \$uri =404;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384;
    ssl_ecdh_curve secp384r1;
    ssl_session_timeout 10m;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://easysite.ai; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: ws: wss:;" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), gyroscope=(), magnetometer=(), payment=()" always;
    add_header Cross-Origin-Embedder-Policy "require-corp" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Cross-Origin-Resource-Policy "same-origin" always;
    
    # Remove Server header
    server_tokens off;
    more_clear_headers Server;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 10240;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # Application proxy
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        limit_conn conn_limit_per_ip 20;
    }
    
    # Static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        access_log off;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # API rate limiting
        limit_req zone=api burst=100 nodelay;
        limit_conn conn_limit_per_ip 50;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # Security monitoring endpoint
    location /security/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Restrict access (implement your own auth logic)
        # allow 192.168.1.0/24;
        # deny all;
    }
}
EOF

    # Test and reload nginx
    nginx -t || error "Nginx SSL configuration test failed"
    systemctl reload nginx || error "Failed to reload Nginx with SSL configuration"
    
    success "Secure Nginx configuration with SSL created and loaded"
}

# Configure rate limiting
configure_rate_limiting() {
    log "Configuring rate limiting..."
    
    cat > "$NGINX_CONFIG_DIR/conf.d/rate-limiting.conf" << 'EOF'
# Rate limiting zones
http {
    # Rate limiting for API endpoints
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    # Connection limiting
    limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
    
    # Rate limiting for login endpoints
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    # Rate limiting status
    limit_req_status 429;
    limit_conn_status 429;
}
EOF
    
    success "Rate limiting configured"
}

# Setup automatic renewal
setup_auto_renewal() {
    log "Setting up automatic certificate renewal..."
    
    # Create renewal hook script
    cat > "/etc/letsencrypt/renewal-hooks/post/nginx-reload.sh" << 'EOF'
#!/bin/bash
systemctl reload nginx
logger "SSL certificate renewed and Nginx reloaded"
EOF
    
    chmod +x "/etc/letsencrypt/renewal-hooks/post/nginx-reload.sh"
    
    # Test renewal process
    certbot renew --dry-run || warning "Certificate renewal test failed"
    
    # Certbot timer should already be enabled, but let's make sure
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    success "Automatic certificate renewal configured"
}

# Test SSL configuration
test_ssl() {
    log "Testing SSL configuration..."
    
    # Test certificate
    openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" < /dev/null 2>/dev/null | \
        openssl x509 -noout -dates || warning "SSL certificate test failed"
    
    # Test HTTPS redirect
    curl -I "http://$DOMAIN" 2>/dev/null | grep -q "301\|302" || warning "HTTPS redirect test failed"
    
    # Test HSTS header
    curl -I "https://$DOMAIN" 2>/dev/null | grep -q "Strict-Transport-Security" || warning "HSTS header test failed"
    
    success "SSL configuration tests completed"
}

# Create monitoring script
create_monitoring() {
    log "Creating SSL monitoring script..."
    
    cat > "/usr/local/bin/ssl-monitor.sh" << 'EOF'
#!/bin/bash

DOMAIN="$1"
DAYS_THRESHOLD="${2:-30}"
LOG_FILE="/var/log/ssl-monitor.log"

if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [days_threshold]"
    exit 1
fi

# Check certificate expiration
CERT_FILE="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

if [ ! -f "$CERT_FILE" ]; then
    echo "Certificate file not found: $CERT_FILE"
    exit 1
fi

EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_FILE" | cut -d= -f2)
EXPIRY_TIMESTAMP=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_TIMESTAMP=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_TIMESTAMP - CURRENT_TIMESTAMP) / 86400 ))

echo "$(date): SSL certificate for $DOMAIN expires in $DAYS_LEFT days" | tee -a "$LOG_FILE"

if [ "$DAYS_LEFT" -le "$DAYS_THRESHOLD" ]; then
    echo "$(date): WARNING: SSL certificate for $DOMAIN expires in $DAYS_LEFT days" | tee -a "$LOG_FILE"
    # Send alert (implement your preferred notification method)
    # systemctl --user start ssl-alert@"$DOMAIN"
fi
EOF
    
    chmod +x "/usr/local/bin/ssl-monitor.sh"
    
    # Create cron job for daily monitoring
    cat > "/etc/cron.d/ssl-monitor" << EOF
# Daily SSL certificate monitoring
0 6 * * * root /usr/local/bin/ssl-monitor.sh $DOMAIN 30
EOF
    
    success "SSL monitoring configured"
}

# Main execution
main() {
    log "Starting SSL setup for NY Fashion POS system"
    
    check_root
    install_dependencies
    create_nginx_config
    obtain_certificate
    create_ssl_config
    configure_rate_limiting
    setup_auto_renewal
    test_ssl
    create_monitoring
    
    success "SSL setup completed successfully!"
    
    echo ""
    echo "Next steps:"
    echo "1. Update your DNS records to point $DOMAIN to this server"
    echo "2. Test your site at https://$DOMAIN"
    echo "3. Monitor the logs at $LOG_FILE"
    echo "4. Set up additional monitoring and alerting as needed"
    echo ""
    echo "SSL Certificate expires on: $(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem | cut -d= -f2)"
    echo "Auto-renewal is configured and will run automatically"
}

# Run main function
main "$@"
