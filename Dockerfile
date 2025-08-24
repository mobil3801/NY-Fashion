# Multi-stage build for React/TypeScript application
# Stage 1: Dependencies installation
FROM node:18-alpine as dependencies

# Set working directory
WORKDIR /app

# Add a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S reactapp -u 1001

# Copy package files for dependency resolution
COPY package.json package-lock.json* ./

# Install dependencies with npm ci for faster, reliable builds
RUN npm ci --only=production --silent && \
    npm cache clean --force

# Stage 2: Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies)
RUN npm ci --silent

# Copy source code and configuration files
COPY . .

# Build the application
RUN npm run build

# Stage 3: Production runtime with Nginx
FROM nginx:alpine as runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user for nginx
RUN addgroup -g 1001 -S nodejs && \
    adduser -S reactapp -u 1001 && \
    chown -R reactapp:nodejs /usr/share/nginx/html && \
    chown -R reactapp:nodejs /var/cache/nginx && \
    chown -R reactapp:nodejs /var/log/nginx && \
    chown -R reactapp:nodejs /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R reactapp:nodejs /var/run/nginx.pid

# Switch to non-root user
USER reactapp

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
