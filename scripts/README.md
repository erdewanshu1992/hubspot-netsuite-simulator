# 🚀 Deployment Scripts

This directory contains automated deployment scripts for the HubSpot-NetSuite Simulator project.

## 📋 Available Scripts

| Script | Purpose | Platforms |
|--------|---------|-----------|
| `deploy.sh` | Traditional deployment | Linux/macOS |
| `deploy-docker.sh` | Docker deployment | Docker-enabled systems |
| `rollback.sh` | Rollback to previous version | All platforms |

## 🛠️ Quick Start

### Traditional Deployment

```bash
# Deploy to staging
./scripts/deploy.sh --environment staging

# Deploy to production
./scripts/deploy.sh --environment production --branch main

# Deploy specific tag
./scripts/deploy.sh --tag v1.0.0 --no-backup

# Dry run (preview deployment)
./scripts/deploy.sh --dry-run --environment production
```

### Docker Deployment

```bash
# Build and deploy with Docker
./scripts/deploy-docker.sh --environment staging

# Build, push to registry, and deploy
./scripts/deploy-docker.sh --environment production --push --tag v1.0.0

# Build only (no deployment)
./scripts/deploy-docker.sh --build-only --tag latest
```

### Rollback

```bash
# List available backups
./scripts/rollback.sh --list-backups

# Rollback to latest backup
./scripts/rollback.sh --backup latest --environment production

# Rollback to specific backup
./scripts/rollback.sh --backup 20231015_143000 --environment staging

# Preview rollback (dry run)
./scripts/rollback.sh --backup latest --dry-run
```

## 🔧 Configuration

### Environment Variables

Create environment files in the `env/` directory:

```bash
# Development
cp env/.env.development .env

# Staging
cp env/.env.staging .env

# Production
cp env/.env.production .env
```

### PM2 Configuration

For production deployments, PM2 uses `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'hubspot-netsuite-simulator',
    script: 'src/index.js',
    instances: 'max',        // Use all CPU cores
    exec_mode: 'cluster',    // Load balancing
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## 📦 Deployment Process

### Traditional Deployment Steps

1. **Pre-deployment Checks**
   - Validates Node.js and npm installation
   - Checks environment configuration
   - Verifies system dependencies

2. **Backup Creation**
   - Creates timestamped backup of current deployment
   - Stores in `backups/` directory
   - Keeps multiple backup versions

3. **Dependency Installation**
   - Runs `npm ci` for clean installation
   - Uses production dependencies for production environment

4. **Testing**
   - Runs complete test suite
   - Validates application functionality
   - Checks for breaking changes

5. **Build Process**
   - Compiles TypeScript (if build script exists)
   - Optimizes assets for production
   - Creates production-ready build

6. **Database Migrations**
   - Applies database schema changes
   - Updates data structure if needed
   - Preserves existing data

7. **Deployment**
   - Copies files to deployment directory
   - Updates symbolic links
   - Configures file permissions

8. **Application Restart**
   - Gracefully stops old application
   - Starts new application version
   - Validates application health

9. **Verification**
   - Checks application responsiveness
   - Validates health check endpoints
   - Confirms successful deployment

10. **Cleanup**
    - Removes old deployment versions
    - Cleans up temporary files
    - Maintains deployment history

### Docker Deployment Steps

1. **Dockerfile Generation**
   - Creates multi-stage Dockerfile
   - Optimizes for production deployment
   - Includes health checks

2. **Docker Compose Setup**
   - Configures application services
   - Sets up MongoDB and Redis
   - Configures networking

3. **Image Building**
   - Builds optimized Docker image
   - Uses Node.js 24.x Alpine base
   - Minimizes image size

4. **Container Deployment**
   - Starts application containers
   - Configures service dependencies
   - Enables health monitoring

## 🔄 Rollback Process

### Automatic Rollback Triggers

- **Health Check Failures**: Automatic rollback if app doesn't respond
- **Memory Issues**: Rollback if memory usage exceeds limits
- **Error Rate Spikes**: Rollback if error rate increases significantly

### Manual Rollback

```bash
# 1. List available backups
./scripts/rollback.sh --list-backups

# 2. Choose backup to rollback to
# Format: YYYYMMDD_HHMMSS

# 3. Perform rollback
./scripts/rollback.sh --backup 20231015_143000 --environment production

# 4. Verify rollback success
curl http://localhost:3000/health
```

### Rollback Safety

- **Backup Creation**: Always creates backup before rollback
- **Atomic Operations**: Rollback is all-or-nothing
- **Quick Recovery**: Typically completes in under 30 seconds
- **Zero Downtime**: Uses load balancer health checks

## 🌍 Environment-Specific Deployment

### Development Environment

```bash
# Quick development deployment
./scripts/deploy.sh --environment development --no-tests

# Features:
# - Debug logging enabled
# - Hot reload for quick development
# - Relaxed security settings
# - Mock external APIs
```

### Staging Environment

```bash
# Staging deployment with full testing
./scripts/deploy.sh --environment staging --branch develop

# Features:
# - Production-like configuration
# - Full test suite execution
# - Realistic data and APIs
# - Performance monitoring
```

### Production Environment

```bash
# Production deployment with maximum safety
./scripts/deploy.sh --environment production --branch main --tag v1.0.0

# Features:
# - Maximum security settings
# - Comprehensive backup strategy
# - Health check validation
# - Rollback capability
```

## 📊 Monitoring & Health Checks

### Health Check Endpoints

```bash
# Application health
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/database

# External API status
curl http://localhost:3000/health/external-apis
```

### PM2 Monitoring

```bash
# View application status
pm2 status

# View logs
pm2 logs hubspot-netsuite-simulator

# Monitor resource usage
pm2 monit

# View application metrics
pm2 jlist
```

### Docker Monitoring

```bash
# Container status
docker-compose ps

# Container logs
docker-compose logs -f app

# Resource usage
docker stats

# Health checks
docker inspect hubspot-netsuite-production | grep -A 5 "Health"
```

## 🚨 Troubleshooting

### Common Issues

#### **Permission Denied**
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run with proper permissions
sudo -E ./scripts/deploy.sh --environment production
```

#### **Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 ./scripts/deploy.sh
```

#### **Memory Issues**
```bash
# Check memory usage
pm2 monit

# Restart with memory limit
pm2 restart hubspot-netsuite-simulator --max-memory-restart 1G
```

#### **Database Connection Issues**
```bash
# Check database connectivity
npm run health:database

# Verify connection string in .env
# Restart database service if needed
```

### Emergency Procedures

#### **Immediate Rollback**
```bash
# Quick rollback to latest backup
./scripts/rollback.sh --backup latest --environment production

# Verify application health
curl http://localhost:3000/health
```

#### **Service Recovery**
```bash
# Restart all services
pm2 restart all

# Or Docker equivalent
docker-compose restart

# Check system resources
df -h  # Disk usage
free -h  # Memory usage
```

## 📈 Performance Optimization

### Deployment Speed

```bash
# Use Docker layer caching
./scripts/deploy-docker.sh --no-cache  # Force rebuild

# Parallel testing
# Matrix testing in GitHub Actions

# Dependency caching
npm cache verify
```

### Memory Optimization

```javascript
// In ecosystem.config.js
module.exports = {
  apps: [{
    // ...
    max_memory_restart: '1G',
    instances: 'max',  // Use available CPU cores
    // ...
  }]
};
```

### Storage Management

```bash
# Clean old deployments
find deployment/releases -type d -mtime +7 -exec rm -rf {} \;

# Clean old backups
find backups -type d -mtime +30 -exec rm -rf {} \;

# Docker cleanup
docker system prune -f
```

## 🔒 Security Considerations

### Production Security

```bash
# Use secure environment variables
chmod 600 .env*

# Restrict script permissions
chmod 700 scripts/*.sh

# Use SSH keys instead of passwords
# Enable firewall rules
```

### Access Control

```bash
# Create deployment user
sudo useradd -m -s /bin/bash deploy

# Add to sudoers for deployment tasks
echo 'deploy ALL=(ALL) NOPASSWD: /path/to/scripts/deploy.sh' | sudo tee /etc/sudoers.d/deploy

# Use SSH keys for authentication
ssh-keygen -t rsa -b 4096 -C "deploy@yourserver"
```

## 📞 Support & Maintenance

### Regular Maintenance

```bash
# Weekly cleanup
./scripts/cleanup.sh

# Monthly backup verification
./scripts/verify-backups.sh

# Quarterly dependency updates
npm audit fix
npm update
```

### Getting Help

1. **Check Logs**: `pm2 logs` or `docker-compose logs`
2. **Monitor Health**: Health check endpoints
3. **Review Backups**: `./scripts/rollback.sh --list-backups`
4. **Check Resources**: `pm2 monit` or `docker stats`

### Emergency Contacts

- **Development Issues**: Check GitHub Actions logs
- **Production Issues**: Use rollback script immediately
- **Security Issues**: Follow security incident response plan

---

## 🎯 Best Practices

1. **Always Test**: Never deploy untested code to production
2. **Backup First**: Always create backups before deployment
3. **Monitor Health**: Set up health check alerts
4. **Document Changes**: Keep deployment logs and change records
5. **Plan Rollback**: Always have a rollback plan ready
6. **Security First**: Follow security best practices
7. **Automate Everything**: Use scripts for consistency

**Happy Deploying!** 🚀