
# Multi-stage build for production optimization
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Install additional tools for zero-downtime deployment
RUN apk add --no-cache curl jq bash

# Copy custom nginx configuration
COPY docker/nginx-deployment.conf /etc/nginx/nginx.conf
COPY docker/nginx-deployment-site.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy deployment scripts
COPY docker/deployment-scripts/ /deployment/
RUN chmod +x /deployment/*.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

EXPOSE 80
CMD ["/deployment/start-with-health-check.sh"]
