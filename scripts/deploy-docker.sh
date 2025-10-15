#!/bin/bash

# =====================================
# Docker Deployment Script
# =====================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-your-registry.com}"
IMAGE_NAME="${DOCKER_REGISTRY}/hubspot-netsuite-simulator"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default values
ENVIRONMENT="staging"
TAG="${TIMESTAMP}"
PUSH_IMAGE=false
BUILD_ONLY=false

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Target environment (staging|production) [default: staging]
    -t, --tag TAG           Docker image tag [default: timestamp]
    --registry REGISTRY     Docker registry URL
    --push                  Push image to registry after building
    --build-only            Only build image, don't deploy
    --no-cache             Don't use Docker cache
    -h, --help              Show this help message

EXAMPLES:
    $0 --environment production --tag v1.0.0 --push
    $0 --build-only --tag latest
    $0 --registry myregistry.com --push

EOF
}

check_docker() {
    log_info "Checking Docker installation..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    log_success "Docker check completed"
}

create_dockerfile() {
    log_info "Creating Dockerfile..."

    cat > "${PROJECT_ROOT}/Dockerfile" << 'EOF'
# =====================================
# Multi-stage Dockerfile
# =====================================

# Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application (if build script exists)
RUN npm run build --if-present || echo "No build script found"

# Production stage
FROM node:24-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

# Create logs directory
RUN mkdir -p logs && chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]
EOF

    log_success "Dockerfile created"
}

create_docker_compose() {
    log_info "Creating docker-compose.yml..."

    cat > "${PROJECT_ROOT}/docker-compose.yml" << EOF
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    container_name: hubspot-netsuite-${ENVIRONMENT}
    environment:
      - NODE_ENV=${ENVIRONMENT}
    env_file:
      - env/.env.${ENVIRONMENT}
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    depends_on:
      - redis
      - mongodb

  mongodb:
    image: mongo:7-jammy
    container_name: hubspot-netsuite-mongo-${ENVIRONMENT}
    environment:
      - MONGO_INITDB_DATABASE=hubspot_netsuite_${ENVIRONMENT}
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: hubspot-netsuite-redis-${ENVIRONMENT}
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  mongodb_data:
  redis_data:

networks:
  default:
    name: hubspot-netsuite-${ENVIRONMENT}
EOF

    log_success "docker-compose.yml created"
}

build_image() {
    log_info "Building Docker image..."

    cd "$PROJECT_ROOT"

    local build_args=(
        --tag "${IMAGE_NAME}:${TAG}"
        --tag "${IMAGE_NAME}:${ENVIRONMENT}"
    )

    # Add latest tag for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        build_args+=(--tag "${IMAGE_NAME}:latest")
    fi

    # Build with or without cache
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args+=(--no-cache)
    fi

    docker build "${build_args[@]}" .

    log_success "Docker image built: ${IMAGE_NAME}:${TAG}"
}

push_image() {
    if [[ "$PUSH_IMAGE" != "true" ]]; then
        log_info "Skipping image push"
        return
    fi

    log_info "Pushing Docker image..."

    # Push specific tag
    docker push "${IMAGE_NAME}:${TAG}"

    # Push environment tag
    docker push "${IMAGE_NAME}:${ENVIRONMENT}"

    # Push latest tag for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker push "${IMAGE_NAME}:latest"
    fi

    log_success "Docker image pushed to registry"
}

deploy_containers() {
    if [[ "$BUILD_ONLY" == "true" ]]; then
        log_info "Build only mode - skipping deployment"
        return
    fi

    log_info "Deploying with Docker Compose..."

    cd "$PROJECT_ROOT"

    # Stop existing containers
    docker-compose down || true

    # Pull latest images (if using pre-built images)
    if [[ "$PUSH_IMAGE" != "true" ]]; then
        docker-compose pull
    fi

    # Start containers
    docker-compose up -d

    # Wait for services to be healthy
    log_info "Waiting for services to start..."
    sleep 10

    # Check container status
    docker-compose ps

    log_success "Application deployed with Docker Compose"
}

cleanup() {
    log_info "Cleaning up Docker resources..."

    # Remove dangling images
    docker image prune -f

    # Remove unused volumes (optional)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_warning "Skipping volume cleanup in production"
    else
        docker volume prune -f
    fi

    log_success "Cleanup completed"
}

# =====================================
# MAIN DEPLOYMENT PROCESS
# =====================================

main() {
    log_info "🐳 Starting Docker deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Image: ${IMAGE_NAME}:${TAG}"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            --registry)
                DOCKER_REGISTRY="$2"
                shift 2
                ;;
            --push)
                PUSH_IMAGE=true
                shift
                ;;
            --build-only)
                BUILD_ONLY=true
                shift
                ;;
            --no-cache)
                NO_CACHE=true
                shift
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done

    # Validate environment
    case "$ENVIRONMENT" in
        "staging"|"production")
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_error "Valid options: staging, production"
            exit 1
            ;;
    esac

    # Execute deployment steps
    check_docker
    create_dockerfile
    create_docker_compose
    build_image

    if [[ "$PUSH_IMAGE" == "true" ]]; then
        push_image
    fi

    deploy_containers
    cleanup

    log_success "🐳 Docker deployment completed!"
    log_info "Application: http://localhost:${PORT:-3000}"
    log_info "Environment: $ENVIRONMENT"
    log_info "Image: ${IMAGE_NAME}:${TAG}"
}

# =====================================
# SCRIPT ENTRY POINT
# =====================================

main "$@"