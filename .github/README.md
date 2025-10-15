# 🚀 GitHub Actions Workflows

This document explains how to use and maintain the GitHub Actions workflows for the HubSpot-NetSuite Simulator project.

## 📋 Table of Contents

- [Overview](#overview)
- [CI/CD Pipeline](#cicd-pipeline)
- [Deployment](#deployment)
- [Security](#security)
- [Dependabot](#dependabot)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The project uses **5 GitHub Actions workflows** to ensure code quality, security, and automated deployment:

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `ci.yml` | Testing & Quality | Push/PR to main/develop |
| `deploy.yml` | Production Deployment | Version tags (`v*`) |
| `security.yml` | Security Scanning | Push/PR + Weekly |
| `dependabot.yml` | Dependency Updates | Weekly |
| `codeql-config.yml` | Security Rules | Configuration |

## 🔄 CI/CD Pipeline (`ci.yml`)

### What It Does

#### **Multi-Node.js Testing**
- Tests on **Node.js 22.x** and **24.x** simultaneously
- Ensures compatibility across Node.js versions
- Catches version-specific issues early

#### **Quality Gates**
1. **TypeScript Compilation** - Validates code syntax
2. **Unit Tests** - Runs Jest test suite
3. **Linting** - Code style and quality checks
4. **Build Verification** - Ensures project builds successfully

#### **End-to-End Testing**
- **Conditional Execution** - Only runs on `main` branch pushes
- **Cypress Integration** - Full E2E test suite
- **Artifact Collection** - Saves screenshots/videos on failure

#### **Coverage Reporting**
- Generates test coverage reports
- Uploads to **Codecov** for tracking
- Monitors code coverage trends

### Workflow Status

```bash
# Check workflow status in GitHub Actions tab
# Green checkmark = All tests passing
# Red X = Tests failing (check logs)
# Yellow circle = In progress
```

### Common Issues

**Problem**: Tests failing on one Node.js version
```bash
# Solution: Check matrix strategy in ci.yml
# Update node-version array if needed
strategy:
  matrix:
    node-version: [22.x, 24.x]  # Add/remove versions here
```

## 🚀 Deployment (`deploy.yml`)

### Manual Deployment

1. **Go to GitHub Actions tab** in your repository
2. **Select "Deploy to Production"** workflow
3. **Click "Run workflow"**
4. **Choose environment** (staging/production)

### Tag-Based Deployment

```bash
# Create version tag (triggers automatic deployment)
git tag v1.0.0
git push origin v1.0.0

# Semantic versioning
git tag v1.2.3  # Major.Minor.Patch
git push origin v1.2.3
```

### Deployment Artifacts

- **Package Creation**: Creates `app-{sha}.tar.gz`
- **30-day Retention**: Artifacts kept for rollback capability
- **Download**: Available in workflow run artifacts

### Environment Variables

Add these secrets to your GitHub repository:

```bash
# GitHub Repository Settings > Secrets and variables > Actions
DEPLOY_KEY=your_ssh_key
SERVER_HOST=your-server.com
```

## 🔒 Security (`security.yml`)

### Weekly Security Scans

- **Automated**: Every Sunday at 2 AM UTC
- **CodeQL Analysis**: Advanced security vulnerability detection
- **Dependency Scanning**: NPM audit and license checks
- **Snyk Integration**: Optional enhanced security scanning

### Security Reports

- **CodeQL Results**: Available in Security tab
- **Dependency Alerts**: Shown in repository insights
- **License Compliance**: Validates all dependencies

### Adding Snyk (Optional)

1. **Create Snyk account** at snyk.io
2. **Get API token** from Snyk dashboard
3. **Add to GitHub Secrets**:
   ```bash
   SNYK_TOKEN=your_snyk_token_here
   ```

## 📦 Dependabot (`dependabot.yml`)

### Weekly Updates

- **Monday 9 AM UTC**: Dependency update checks
- **Grouped Updates**: Related packages updated together
- **Automated PRs**: Creates pull requests for updates

### Update Groups

| Group | Packages | Purpose |
|-------|----------|---------|
| **typescript** | TypeScript, @types/* | Type safety |
| **testing** | Jest, Cypress, ts-jest | Testing tools |
| **linting** | ESLint, @typescript-eslint/* | Code quality |

### Managing Updates

```bash
# View Dependabot PRs
gh pr list --author "dependabot"

# Merge minor updates automatically
# Configure branch protection rules

# Security updates (merge immediately)
# Marked with "security" label
```

## 🛠️ Troubleshooting

### Common Issues

#### **1. Node.js Version Issues**
```yaml
# Update in all workflow files
- name: Use Node.js 24.x
  uses: actions/setup-node@v4
  with:
    node-version: 24.x  # Match your local version
```

#### **2. Test Failures**
```bash
# Check workflow logs
# Look for specific error messages
# Common issues:
# - Missing dependencies
# - Environment variables
# - Database connections
```

#### **3. Deployment Failures**
```bash
# Check deployment logs
# Verify server connectivity
# Check SSH keys and permissions
# Validate environment variables
```

### Debug Mode

Enable debug logging in workflow:

```yaml
- name: Debug workflow
  run: |
    echo "Node version: $(node -v)"
    echo "NPM version: $(npm -v)"
    echo "Working directory: $(pwd)"
    ls -la
```

### Getting Help

1. **Check Workflow Logs**: GitHub Actions tab > Specific run
2. **Review Artifacts**: Download for local debugging
3. **Check Dependencies**: `npm ls` for version conflicts
4. **Environment Issues**: Verify all secrets are set

## 📊 Monitoring & Maintenance

### Workflow Health

- **Regular Checks**: Monitor success rates
- **Performance**: Track execution times
- **Dependencies**: Keep workflows updated

### Cost Optimization

```yaml
# Use caching for faster builds
- uses: actions/setup-node@v4
  with:
    cache: 'npm'  # Speeds up dependency installation

# Conditional execution
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

### Best Practices

1. **Pin Action Versions**: Use `@v4` instead of `@main`
2. **Cache Dependencies**: Speeds up workflow execution
3. **Conditional Jobs**: Only run necessary steps
4. **Artifact Cleanup**: Manage storage costs
5. **Secret Management**: Use GitHub secrets properly

## 🚨 Emergency Procedures

### **Stopping Deployment**
```bash
# Cancel workflow run in GitHub Actions tab
# Use "Cancel workflow" button
```

### **Rollback Deployment**
```bash
# Use previous deployment artifact
# Download from workflow artifacts
# Deploy manually if needed
```

### **Security Issues**
```bash
# Immediate response for security vulnerabilities
# Update dependencies immediately
# Review and merge security PRs quickly
```

---

## 📞 Support

For issues with GitHub Actions:

1. **Check workflow logs** for error details
2. **Review GitHub Actions documentation**
3. **Check GitHub Community Discussions**
4. **Create issue** in repository if needed

**Remember**: GitHub Actions are powerful but require proper configuration and maintenance! 🔧