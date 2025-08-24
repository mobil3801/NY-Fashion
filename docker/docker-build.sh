#!/bin/bash

# Docker build script for React TypeScript application
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="react-typescript-app"
VERSION=${1:-latest}
BUILD_CONTEXT="."

echo -e "${YELLOW}Building React TypeScript Application Docker Image...${NC}"

# Development build
echo -e "${GREEN}Building development image...${NC}"
docker build \
  --target development \
  --tag ${IMAGE_NAME}:dev-${VERSION} \
  --file Dockerfile.dev \
  ${BUILD_CONTEXT}

# Production build
echo -e "${GREEN}Building production image...${NC}"
docker build \
  --target runtime \
  --tag ${IMAGE_NAME}:${VERSION} \
  --tag ${IMAGE_NAME}:latest \
  ${BUILD_CONTEXT}

# Build statistics
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${YELLOW}Image sizes:${NC}"
docker images ${IMAGE_NAME}

# Optional: Run security scan (if trivy is installed)
if command -v trivy &> /dev/null; then
    echo -e "${YELLOW}Running security scan...${NC}"
    trivy image ${IMAGE_NAME}:${VERSION}
fi

echo -e "${GREEN}Docker build process completed!${NC}"
echo -e "${YELLOW}To start development: docker-compose up${NC}"
echo -e "${YELLOW}To start production: docker-compose -f docker-compose.prod.yml up -d${NC}"
