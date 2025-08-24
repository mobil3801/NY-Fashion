# Docker Setup for React TypeScript Application

This directory contains Docker configuration files for containerizing the React TypeScript application with multi-stage builds, development and production environments.

## 📁 Files Overview

- **Dockerfile**: Multi-stage production build with Nginx
- **Dockerfile.dev**: Development build with hot reloading
- **docker-compose.yml**: Development environment setup
- **docker-compose.prod.yml**: Production environment setup
- **nginx.conf**: Production Nginx configuration
- **.dockerignore**: Files to exclude from Docker context
- **docker-build.sh**: Build automation script
- **docker-entrypoint.sh**: Advanced container initialization

## 🚀 Quick Start

### Development Environment

```bash
# Start development server with hot reloading
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f react-dev

# Stop development environment
docker-compose down
```

### Production Environment

```bash
# Build and start production environment
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production environment
docker-compose -f docker-compose.prod.yml down
```

### Manual Build

```bash
# Make build script executable
chmod +x docker/docker-build.sh

# Build both development and production images
./docker/docker-build.sh

# Build with specific version
./docker/docker-build.sh v1.0.0
```

## 🏗️ Build Stages

### Stage 1: Dependencies
- Installs production dependencies only
- Optimized for caching

### Stage 2: Builder
- Installs all dependencies (including dev)
- Builds the React application
- Optimizes assets

### Stage 3: Runtime
- Uses Nginx Alpine for minimal size
- Serves static files efficiently
- Includes security headers and optimizations

## 🔒 Security Features

- **Non-root user**: Containers run as non-privileged user
- **Read-only filesystem**: Production containers have read-only root filesystem
- **Security headers**: Nginx configured with security headers
- **Minimal attack surface**: Only necessary packages installed
- **Capability dropping**: Unnecessary Linux capabilities removed

## 📊 Performance Optimizations

- **Multi-stage builds**: Smaller final images
- **Layer caching**: Optimized Dockerfile layer ordering
- **Gzip compression**: Nginx configured for compression
- **Asset caching**: Long-term caching for static assets
- **Health checks**: Built-in container health monitoring

## 🛠️ Development Features

- **Hot reloading**: Source code changes reflected instantly
- **Volume mounting**: Efficient development workflow
- **Port mapping**: Accessible on localhost:3000
- **Environment variables**: Development-specific configuration

## 📈 Monitoring & Debugging

```bash
# Check container health
docker ps

# View container resources
docker stats

# Execute commands inside container
docker exec -it react-dev sh
docker exec -it react-app-prod sh

# View container logs
docker logs react-dev
docker logs react-app-prod
```

## 🔧 Customization

### Environment Variables

Development:
- `NODE_ENV=development`
- `VITE_NODE_ENV=development`
- `CHOKIDAR_USEPOLLING=true`
- `FAST_REFRESH=true`

Production:
- `NODE_ENV=production`

### Nginx Configuration

Modify `docker/nginx.conf` to customize:
- Security headers
- Caching policies
- Compression settings
- Route handling

### Docker Compose Override

Create `docker-compose.override.yml` for local customizations:

```yaml
version: '3.8'
services:
  react-dev:
    ports:
      - "8080:3000"  # Use different port
    environment:
      - CUSTOM_ENV_VAR=value
```

## 📋 Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   # Change port in docker-compose.yml
   ports:
     - "3001:3000"  # Use different host port
   ```

2. **Permission errors**:
   ```bash
   # Fix file permissions
   sudo chown -R $USER:$USER .
   ```

3. **Hot reloading not working**:
   - Ensure `CHOKIDAR_USEPOLLING=true` is set
   - Check volume mounts are correct

4. **Build failures**:
   ```bash
   # Clean Docker cache
   docker builder prune -a
   
   # Rebuild without cache
   docker-compose build --no-cache
   ```

## 📏 Image Sizes

Typical image sizes:
- Development: ~800MB (includes dev dependencies)
- Production: ~50MB (optimized with Nginx Alpine)

## 🔄 CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Build Docker images
  run: |
    docker build -t myapp:dev --target development -f Dockerfile.dev .
    docker build -t myapp:prod .
    
- name: Run tests in container
  run: docker run --rm myapp:dev npm test
```

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage Builds](https://docs.docker.com/develop/multistage-build/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Configuration](https://nginx.org/en/docs/)
