# 🚀 HubSpot-NetSuite Simulator

[![Node.js Version](https://img.shields.io/badge/node.js-24.x-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A comprehensive integration simulator that synchronizes data between HubSpot CRM and NetSuite ERP systems. Built with Node.js, TypeScript, and modern development practices.

## 🌟 Features

- **🔄 Real-time Synchronization**: Bidirectional data sync between HubSpot and NetSuite
- **📊 Data Mapping**: Intelligent field mapping and transformation
- **🔔 Webhook Processing**: Real-time webhook event handling
- **✅ Data Validation**: Comprehensive validation and cleaning
- **📈 Monitoring**: Built-in health checks and metrics
- **🚀 Auto Deployment**: Automated CI/CD with GitHub Actions
- **🔒 Security**: Enterprise-grade security and validation
- **📱 RESTful API**: Clean API design with OpenAPI documentation

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HubSpot CRM   │    │   Integration   │    │  NetSuite ERP   │
│                 │    │    Layer        │    │                 │
│  • Deals        │◄──►│                 │◄──►│  • Opportunities│
│  • Companies    │    │  • Data Mapping │    │  • Items        │
│  • Contacts     │    │  • Validation   │    │  • Customers    │
│  • Line Items   │    │  • Monitoring   │    │  • Orders       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 24.x** (or 22.x)
- **MongoDB** for data persistence
- **Redis** for caching (optional)
- **HubSpot API Key**
- **NetSuite Account Credentials**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/hubspot-netsuite-simulator.git
   cd hubspot-netsuite-simulator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env/.env.development .env
   # Edit .env with your API credentials
   ```

4. **Start the application**
   ```bash
   npm run dev
   ```

5. **Verify installation**
   ```bash
   curl http://localhost:3000/health
   ```

## 📚 Documentation

- **[📖 Development Guide](DEVELOPMENT.md)** - Comprehensive development documentation
- **[🤝 Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[🚀 Deployment Guide](scripts/README.md)** - Deployment and operations guide
- **[⚙️ GitHub Actions Guide](.github/README.md)** - CI/CD pipeline documentation

## 🔧 Configuration

### Environment Files

| File | Purpose | Usage |
|------|---------|-------|
| `.env.example` | Template | Copy to create your `.env` |
| `env/.env.development` | Development | Local development |
| `env/.env.staging` | Staging | Testing environment |
| `env/.env.production` | Production | Production deployment |

### Key Configuration

```bash
# Application
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/hubspot_netsuite_dev

# APIs
HUBSPOT_API_KEY=your_hubspot_api_key
NETSUITE_ACCOUNT_ID=your_netsuite_account_id

# Monitoring
LOG_LEVEL=info
HEALTH_CHECK_ENABLED=true
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🚀 Deployment

### Traditional Deployment

```bash
# Deploy to staging
./scripts/deploy.sh --environment staging

# Deploy to production
./scripts/deploy.sh --environment production --branch main

# Rollback if needed
./scripts/rollback.sh --backup latest
```

### Docker Deployment

```bash
# Build and deploy
./scripts/deploy-docker.sh --environment production --push

# Deploy existing image
./scripts/deploy-docker.sh --environment staging
```

### GitHub Actions

The project includes comprehensive GitHub Actions workflows:

- **CI/CD Pipeline**: Automated testing and deployment
- **Security Scanning**: CodeQL and dependency analysis
- **Dependabot**: Automated dependency updates
- **Multi-Node.js**: Tests on Node.js 22.x and 24.x

## 📊 Monitoring

### Health Checks

```bash
# Basic health check
GET /health

# Detailed health check
GET /health/detailed

# Database health
GET /health/database

# External APIs health
GET /health/external-apis

# Application metrics
GET /metrics
```

### Logging

The application uses structured logging with Pino:

- **Development**: Debug and info level logging
- **Production**: Warning and error level logging
- **Request Tracking**: Automatic request/response logging
- **Performance Monitoring**: Slow query detection

## 🔒 Security

- **Input Validation**: Joi schema validation
- **Rate Limiting**: Express rate limiting middleware
- **CORS Protection**: Configurable CORS settings
- **Error Sanitization**: Safe error message handling
- **Environment Variables**: Secure configuration management

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Add tests** for new functionality
5. **Submit** a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **HubSpot** for their excellent CRM platform and API
- **NetSuite** for their comprehensive ERP solutions
- **Node.js** community for excellent tools and libraries
- **Open Source** contributors for making this possible

## 📞 Support

- **📖 Documentation**: Check the docs folder for detailed guides
- **🐛 Issues**: Report bugs via GitHub Issues
- **💡 Features**: Request features via GitHub Issues
- **🔧 Help**: Get help via GitHub Discussions

---

<div align="center">

**Built with ❤️ for seamless HubSpot-NetSuite integration**

[⭐ Star this repo] • [🐛 Report issues] • [📖 Read docs] • [🚀 View demo]

</div>
