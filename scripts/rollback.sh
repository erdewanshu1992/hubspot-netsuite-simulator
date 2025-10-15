#!/bin/bash

# =====================================
# Rollback Script
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
DEPLOYMENT_DIR="${PROJECT_ROOT}/deployment"
BACKUP_DIR="${PROJECT_ROOT}/backups"

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
    -b, --backup BACKUP      Specific backup to rollback to (timestamp or 'latest')
    --list-backups          List available backups
    --dry-run               Show what would be rolled back without doing it
    -h, --help              Show this help message

EXAMPLES:
    $0 --environment production --backup latest
    $0 --list-backups
    $0 --backup 20231015_143000 --dry-run

EOF
}

list_backups() {
    log_info "Available backups in $BACKUP_DIR:"

    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_warning "Backup directory not found: $BACKUP_DIR"
        return
    fi

    local backups=$(ls -la "$BACKUP_DIR" | grep "^d" | awk '{print $9}' | grep -v "^\.$" | sort -r)

    if [[ -z "$backups" ]]; then
        log_warning "No backups found"
        return
    fi

    echo
    printf "%-20s %-15s %-10s\n" "BACKUP NAME" "CREATED" "SIZE"
    echo "----------------------------------------"

    for backup in $backups; do
        local backup_path="$BACKUP_DIR/$backup"
        local created=$(stat -c %y "$backup_path" 2>/dev/null || stat -f %Sm "$backup_path" 2>/dev/null || echo "Unknown")
        local size=$(du -sh "$backup_path" 2>/dev/null | cut -f1 || echo "Unknown")

        printf "%-20s %-15s %-10s\n" "$backup" "$created" "$size"
    done
    echo
}

validate_backup() {
    local backup_name="$1"

    if [[ ! -d "$BACKUP_DIR/$backup_name" ]]; then
        log_error "Backup not found: $BACKUP_DIR/$backup_name"
        log_info "Use --list-backups to see available backups"
        exit 1
    fi

    log_success "Backup validated: $backup_name"
}

perform_rollback() {
    local backup_name="$1"
    local backup_path="$BACKUP_DIR/$backup_name"

    log_info "Starting rollback to: $backup_name"

    # Stop current application
    log_info "Stopping current application..."
    if command -v pm2 &> /dev/null; then
        pm2 stop ecosystem.config.js || true
        pm2 delete ecosystem.config.js || true
    else
        pkill -f "node.*src/index.js" || true
    fi

    # Create backup of current state before rollback
    local pre_rollback_backup="pre_rollback_$(date +%Y%m%d_%H%M%S)"
    if [[ -d "$DEPLOYMENT_DIR/current" ]]; then
        cp -r "$DEPLOYMENT_DIR/current" "$BACKUP_DIR/$pre_rollback_backup"
        log_success "Pre-rollback backup created: $pre_rollback_backup"
    fi

    # Perform rollback
    log_info "Performing rollback..."
    rm -rf "$DEPLOYMENT_DIR/current"
    cp -r "$backup_path" "$DEPLOYMENT_DIR/current"

    # Restore environment file if exists
    if [[ -f "$backup_path/.env" ]]; then
        cp "$backup_path/.env" "$DEPLOYMENT_DIR/current/"
    fi

    # Restart application
    log_info "Restarting application..."
    cd "$DEPLOYMENT_DIR/current"

    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js
        pm2 save
    else
        nohup npm start > "logs/rollback.log" 2>&1 &
    fi

    # Verify rollback
    sleep 5
    if curl -f "http://localhost:3000/health" &>/dev/null; then
        log_success "Rollback completed successfully!"
        log_info "Application is running at: http://localhost:3000"
    else
        log_warning "Application may still be starting..."
    fi
}

# =====================================
# MAIN ROLLBACK PROCESS
# =====================================

main() {
    local environment="staging"
    local backup_name=""
    local list_mode=false
    local dry_run=false

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                environment="$2"
                shift 2
                ;;
            -b|--backup)
                backup_name="$2"
                shift 2
                ;;
            --list-backups)
                list_mode=true
                shift
                ;;
            --dry-run)
                dry_run=true
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

    # Handle list mode
    if [[ "$list_mode" == "true" ]]; then
        list_backups
        exit 0
    fi

    # Validate backup name
    if [[ -z "$backup_name" ]]; then
        log_error "No backup specified"
        log_info "Use --backup <backup_name> or --list-backups to see available backups"
        exit 1
    fi

    # Handle special backup names
    case "$backup_name" in
        "latest")
            # Find latest backup
            if [[ ! -d "$BACKUP_DIR" ]]; then
                log_error "Backup directory not found: $BACKUP_DIR"
                exit 1
            fi

            backup_name=$(ls -t "$BACKUP_DIR" | head -n 1)

            if [[ -z "$backup_name" ]]; then
                log_error "No backups found"
                exit 1
            fi

            log_info "Using latest backup: $backup_name"
            ;;
    esac

    # Dry run mode
    if [[ "$dry_run" == "true" ]]; then
        log_info "🔍 DRY RUN MODE - No actual rollback will occur"
        log_info "Would rollback environment: $environment"
        log_info "Would rollback to backup: $backup_name"
        log_info "Backup location: $BACKUP_DIR/$backup_name"
        exit 0
    fi

    # Validate environment
    case "$environment" in
        "staging"|"production")
            ;;
        *)
            log_error "Invalid environment: $environment"
            log_error "Valid options: staging, production"
            exit 1
            ;;
    esac

    # Execute rollback
    validate_backup "$backup_name"
    perform_rollback "$backup_name"

    log_success "🔄 Rollback completed!"
    log_info "Environment: $environment"
    log_info "Rolled back to: $backup_name"
    log_info "Rollback time: $(date)"
}

# =====================================
# SCRIPT ENTRY POINT
# =====================================

main "$@"