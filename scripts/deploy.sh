#!/bin/bash

# =====================================
# HubSpot-NetSuite Simulator
# Deployment Script
# =====================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEPLOYMENT_DIR="${PROJECT_ROOT}/deployment"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default values
ENVIRONMENT="staging"
BRANCH="main"
CREATE_BACKUP=true
RUN_MIGRATIONS=true
RUN_TESTS=true

# =====================================
# UTILITY FUNCTIONS
# =====================================

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
    -e, --environment ENV    Target environment (development|staging|production) [default: staging]
    -b, --branch BRANCH      Source branch to deploy [default: main]
    -t, --tag TAG           Deploy specific tag instead of branch
    --no-backup             Skip backup creation
    --no-migrations         Skip database migrations
    --no-tests              Skip running tests
    --dry-run               Show what would be deployed without doing it
    -h, --help              Show this help message

EXAMPLES:
    $0 --environment production --branch main
    $0 --tag v1.0.0 --no-backup
    $0 --dry-run --environment staging

EOF
}

check_dependencies() {
    log_info "Checking dependencies..."

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi

    # Check if PM2 is installed (for production)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if ! command -v pm2 &> /dev/null; then
            log_warning "PM2 not found. Installing globally..."
            npm install -g pm2
        fi
    fi

    log_success "Dependencies check completed"
}

create_backup() {
    if [[ "$CREATE_BACKUP" != "true" ]]; then
        log_info "Skipping backup creation"
        return
    fi

    log_info "Creating backup..."

    mkdir -p "$BACKUP_DIR"

    # Backup current deployment
    if [[ -d "$DEPLOYMENT_DIR/current" ]]; then
        local backup_name="backup_${TIMESTAMP}"
        cp -r "$DEPLOYMENT_DIR/current" "$BACKUP_DIR/$backup_name"
        log_success "Backup created: $BACKUP_DIR/$backup_name"
    else
        log_warning "No existing deployment found to backup"
    fi
}

install_dependencies() {
    log_info "Installing dependencies..."

    cd "$PROJECT_ROOT"

    # Clean npm cache if needed
    if [[ "$ENVIRONMENT" == "production" ]]; then
        npm ci --production
    else
        npm ci
    fi

    log_success "Dependencies installed"
}

run_tests() {
    if [[ "$RUN_TESTS" != "true" ]]; then
        log_info "Skipping tests"
        return
    fi

    log_info "Running tests..."

    cd "$PROJECT_ROOT"
    npm test

    log_success "All tests passed"
}

build_application() {
    log_info "Building application..."

    cd "$PROJECT_ROOT"

    # Build if build script exists
    if npm run | grep -q "build"; then
        npm run build
        log_success "Application built successfully"
    else
        log_info "No build script found, skipping build"
    fi
}

run_migrations() {
    if [[ "$RUN_MIGRATIONS" != "true" ]]; then
        log_info "Skipping migrations"
        return
    fi

    log_info "Running database migrations..."

    cd "$PROJECT_ROOT"

    # Run migrations if migration script exists
    if npm run | grep -q "migrate"; then
        npm run migrate
        log_success "Migrations completed"
    else
        log_info "No migration script found, skipping migrations"
    fi
}

deploy_application() {
    log_info "Deploying application..."

    cd "$PROJECT_ROOT"

    # Create deployment directory structure
    mkdir -p "$DEPLOYMENT_DIR/releases/$TIMESTAMP"

    # Copy application files (exclude unnecessary files)
    rsync -av --exclude='node_modules' \
             --exclude='.git' \
             --exclude='cypress' \
             --exclude='tests' \
             --exclude='.github' \
             --exclude='*.log' \
             --exclude='coverage' \
             --exclude='backups' \
             --exclude='deployment' \
             --exclude='scripts' \
             . "$DEPLOYMENT_DIR/releases/$TIMESTAMP/"

    # Copy node_modules and other necessary files
    cp -r node_modules "$DEPLOYMENT_DIR/releases/$TIMESTAMP/"
    cp .env* "$DEPLOYMENT_DIR/releases/$TIMESTAMP/" 2>/dev/null || true

    # Update current symlink
    ln -sfn "$DEPLOYMENT_DIR/releases/$TIMESTAMP" "$DEPLOYMENT_DIR/current"

    log_success "Application deployed to: $DEPLOYMENT_DIR/current"
}

restart_application() {
    log_info "Restarting application..."

    cd "$PROJECT_ROOT"

    case "$ENVIRONMENT" in
        "production")
            # Use PM2 for production
            if command -v pm2 &> /dev/null; then
                pm2 reload ecosystem.config.js || pm2 start ecosystem.config.js
                pm2 save
                log_success "Application restarted with PM2"
            else
                log_error "PM2 not available for production restart"
                exit 1
            fi
            ;;
        "staging"|"development")
            # Use npm for development/staging
            # Kill any existing process
            pkill -f "node.*src/index.js" || true

            # Start application
            nohup npm start > "logs/${ENVIRONMENT}.log" 2>&1 &
            log_success "Application restarted"
            ;;
    esac
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Wait for application to start
    sleep 5

    # Check if application is responding
    if curl -f "http://localhost:3000/health" &>/dev/null; then
        log_success "Deployment verification successful"
    else
        log_warning "Deployment verification failed - application may still be starting"
    fi
}

cleanup_old_releases() {
    log_info "Cleaning up old releases..."

    cd "$DEPLOYMENT_DIR/releases"

    # Keep only last 5 releases
    ls -t | tail -n +6 | xargs -r rm -rf

    log_success "Old releases cleaned up"
}

# =====================================
# MAIN DEPLOYMENT PROCESS
# =====================================

main() {
    log_info "🚀 Starting deployment process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Branch: $BRANCH"
    log_info "Timestamp: $TIMESTAMP"

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -b|--branch)
                BRANCH="$2"
                shift 2
                ;;
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            --no-backup)
                CREATE_BACKUP=false
                shift
                ;;
            --no-migrations)
                RUN_MIGRATIONS=false
                shift
                ;;
            --no-tests)
                RUN_TESTS=false
                shift
                ;;
            --dry-run)
                DRY_RUN=true
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
        "development"|"staging"|"production")
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT"
            log_error "Valid options: development, staging, production"
            exit 1
            ;;
    esac

    # Load environment variables
    if [[ -f "env/.env.${ENVIRONMENT}" ]]; then
        log_info "Loading environment configuration: .env.${ENVIRONMENT}"
        # Export environment variables for the deployment process
        set -a
        source "env/.env.${ENVIRONMENT}"
        set +a
    else
        log_warning "Environment file not found: env/.env.${ENVIRONMENT}"
    fi

    # Dry run mode
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "🔍 DRY RUN MODE - No actual deployment will occur"
        log_info "Would deploy environment: $ENVIRONMENT"
        log_info "Would use branch: $BRANCH"
        log_info "Would create backup: $CREATE_BACKUP"
        log_info "Would run migrations: $RUN_MIGRATIONS"
        log_info "Would run tests: $RUN_TESTS"
        exit 0
    fi

    # Execute deployment steps
    check_dependencies
    create_backup
    install_dependencies

    if [[ "$RUN_TESTS" == "true" ]]; then
        run_tests
    fi

    build_application

    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        run_migrations
    fi

    deploy_application
    restart_application
    verify_deployment
    cleanup_old_releases

    log_success "🎉 Deployment completed successfully!"
    log_info "Environment: $ENVIRONMENT"
    log_info "Deployment time: $(date)"
    log_info "Application should be running at: http://localhost:3000"
}

# =====================================
# SCRIPT ENTRY POINT
# =====================================

main "$@"