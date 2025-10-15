# 🛠️ Development Guidelines

Comprehensive guide for developing the HubSpot-NetSuite Simulator project.

## 📋 Table of Contents

- [Environment Setup](#environment-setup)
- [Development Workflow](#development-workflow)
- [Code Organization](#code-organization)
- [API Development](#api-development)
- [Database Operations](#database-operations)
- [External Integrations](#external-integrations)
- [Error Handling](#error-handling)
- [Performance Optimization](#performance-optimization)

## 🏗️ Environment Setup

### Local Development

1. **Install Node.js 24.x**
   ```bash
   # Using nvm (recommended)
   nvm install 24
   nvm use 24
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp env/.env.development .env
   # Edit .env with your local configuration
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Development Tools

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Build project
npm run build

# Generate documentation
npm run docs
```

## 🔄 Development Workflow

### Daily Development

```bash
# 1. Pull latest changes
git pull origin develop

# 2. Create feature branch
git checkout -b feature/new-feature

# 3. Make changes with tests
# Write code -> Write tests -> Run tests

# 4. Commit changes
git add .
git commit -m "feat: add new feature

- Add feature description
- Include relevant details
- Reference issue numbers"

# 5. Push and create PR
git push origin feature/new-feature
```

### Code Quality Checks

```bash
# Pre-commit hooks (if configured)
# - Linting
# - Type checking
# - Tests
# - Build verification

# Manual quality checks
npm run quality-check
```

## 📁 Code Organization

### Service Layer Architecture

```
src/
├── controllers/     # HTTP request handlers
├── services/       # Business logic layer
├── models/         # Data models and schemas
├── middleware/     # Express middleware
├── routes/         # Route definitions
├── config/         # Configuration management
└── types/          # TypeScript type definitions
```

### Service Responsibilities

- **Controllers**: Handle HTTP requests, validate input, return responses
- **Services**: Contain business logic, orchestrate operations
- **Models**: Define data structures and validation
- **Middleware**: Cross-cutting concerns (auth, logging, validation)
- **Routes**: Define API endpoints and map to controllers

### File Naming Conventions

```typescript
// Service files: singular, kebab-case
user-service.ts
hubspot-service.ts
netsuite-service.ts

// Controller files: plural, kebab-case
users-controller.ts
webhooks-controller.ts

// Model files: singular, kebab-case
user-model.ts
opportunity-model.ts

// Type files: descriptive, kebab-case
api-types.ts
database-types.ts
```

## 🔌 API Development

### RESTful Endpoints

```typescript
// ✅ Good endpoint design
GET    /api/v1/users           # List users
POST   /api/v1/users           # Create user
GET    /api/v1/users/:id       # Get user by ID
PUT    /api/v1/users/:id       # Update user
DELETE /api/v1/users/:id       # Delete user

// ❌ Avoid
GET    /api/v1/getUsers        # Non-RESTful
POST   /api/v1/createUser      # Non-RESTful
```

### Request/Response Format

```typescript
// Request validation middleware
const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details
    });
  }
  next();
};

// Standardized response format
const sendSuccess = (res: Response, data: any, message?: string) => {
  res.json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
};

const sendError = (res: Response, error: string, statusCode: number = 500) => {
  res.status(statusCode).json({
    success: false,
    error,
    timestamp: new Date().toISOString()
  });
};
```

### API Versioning

```typescript
// Route with versioning
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// Header-based versioning
const apiVersion = req.headers['api-version'] || 'v1';
```

## 🗄️ Database Operations

### Connection Management

```typescript
import mongoose from 'mongoose';

// Database connection with retry logic
export const connectDatabase = async (retries: number = 3): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI!);
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      logger.error(`Database connection attempt ${i + 1} failed`, error);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### Model Definition

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
```

### Query Optimization

```typescript
// ✅ Efficient queries
const users = await User.find({ active: true })
  .select('name email')  // Only select needed fields
  .limit(50)             // Limit results
  .sort({ createdAt: -1 }) // Sort by creation date
  .lean();               // Return plain objects

// ❌ Inefficient queries
const users = await User.find({})  // No filters
  .populate('all')     // Populate everything
  .limit(10000);       // Too many results
```

## 🔗 External Integrations

### HubSpot Integration

```typescript
import axios from 'axios';

export class HubSpotService {
  private baseURL = 'https://api.hubapi.com';
  private apiKey: string;

  constructor() {
    this.apiKey = env.get('HUBSPOT_API_KEY');
  }

  async getDeal(dealId: string): Promise<any> {
    const startTime = Date.now();

    try {
      const response = await axios.get(
        `${this.baseURL}/deals/v1/deal/${dealId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Record metrics
      monitoringService.recordHubSpotApiCall(
        Date.now() - startTime,
        true
      );

      return response.data;
    } catch (error) {
      monitoringService.recordHubSpotApiCall(
        Date.now() - startTime,
        false
      );

      throw new HubSpotError(
        `Failed to get deal: ${error.message}`,
        error.response?.status || 500
      );
    }
  }
}
```

### NetSuite Integration

```typescript
import axios from 'axios';

export class NetSuiteService {
  private baseURL: string;
  private consumerKey: string;
  private consumerSecret: string;
  private tokenId: string;
  private tokenSecret: string;

  constructor() {
    this.baseURL = env.get('NETSUITE_REST_ENDPOINT');
    this.consumerKey = env.get('NETSUITE_CONSUMER_KEY');
    this.consumerSecret = env.get('NETSUITE_CONSUMER_SECRET');
    this.tokenId = env.get('NETSUITE_TOKEN_ID');
    this.tokenSecret = env.get('NETSUITE_TOKEN_SECRET');
  }

  async getOpportunity(opportunityId: string): Promise<any> {
    const startTime = Date.now();

    try {
      const response = await axios.get(
        `${this.baseURL}/record/v1/opportunity/${opportunityId}`,
        {
          auth: {
            username: `${this.consumerKey}:${this.consumerSecret}`,
            password: `${this.tokenId}:${this.tokenSecret}`
          }
        }
      );

      monitoringService.recordNetSuiteApiCall(
        Date.now() - startTime,
        true
      );

      return response.data;
    } catch (error) {
      monitoringService.recordNetSuiteApiCall(
        Date.now() - startTime,
        false
      );

      throw new NetSuiteError(
        `Failed to get opportunity: ${error.message}`,
        error.response?.status || 500
      );
    }
  }
}
```

## 🚨 Error Handling

### Custom Error Classes

```typescript
export class BaseError extends Error {
  public readonly name: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, public readonly errors: any[]) {
    super(message, 400, true);
  }
}

export class HubSpotError extends BaseError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, true);
  }
}

export class NetSuiteError extends BaseError {
  constructor(message: string, statusCode: number = 500) {
    super(message, statusCode, true);
  }
}
```

### Global Error Handler

```typescript
import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Unhandled error', error, {
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle known error types
  if (error instanceof ValidationError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.errors,
      type: 'validation_error'
    });
    return;
  }

  if (error instanceof HubSpotError || error instanceof NetSuiteError) {
    res.status(error.statusCode).json({
      error: error.message,
      type: error.name.toLowerCase()
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    error: 'Internal server error',
    type: 'internal_error'
  });
};
```

## ⚡ Performance Optimization

### Caching Strategy

```typescript
import { env } from '../config/env-loader';

export class CacheService {
  private cache = new Map();

  set(key: string, value: any, ttlSeconds: number = 300): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000);

    this.cache.set(key, {
      value,
      expiresAt
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### Database Optimization

```typescript
// Use indexes for frequently queried fields
UserSchema.index({ email: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ status: 1, createdAt: -1 });

// Use lean() for read-only operations
const users = await User.find({ active: true }).lean();

// Use aggregation for complex queries
const stats = await User.aggregate([
  {
    $match: { createdAt: { $gte: startDate } }
  },
  {
    $group: {
      _id: null,
      totalUsers: { $sum: 1 },
      avgAge: { $avg: '$age' }
    }
  }
]);
```

### API Performance

```typescript
// Implement pagination
app.get('/api/users', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

  const users = await User.find()
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .exec();

  const total = await User.countDocuments();

  res.json({
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// Implement rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
```

## 🔒 Security Best Practices

### Input Validation

```typescript
import Joi from 'joi';

const userSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(100).required(),
  age: Joi.number().integer().min(18).max(120).optional()
});

// Validate request body
export const validateUser = (req: Request, res: Response, next: NextFunction) => {
  const { error } = userSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map(detail => detail.message)
    });
  }

  next();
};
```

### Authentication Middleware

```typescript
import jwt from 'jsonwebtoken';

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!);

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### Data Sanitization

```typescript
import DOMPurify from 'isomorphic-dompurify';

// Sanitize HTML content
export const sanitizeHtml = (content: string): string => {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: []
  });
};

// Sanitize user input
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};
```

## 📊 Monitoring & Observability

### Health Checks

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const healthCheck = await monitoringService.performHealthCheck();

  res.status(healthCheck.status === 'healthy' ? 200 : 503).json(healthCheck);
});

// Detailed health check
app.get('/health/detailed', async (req, res) => {
  const healthCheck = await monitoringService.performHealthCheck();
  res.json(healthCheck);
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  const metrics = monitoringService.getMetrics();
  res.json(metrics);
});
```

### Logging Strategy

```typescript
// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  logger.info('Request started', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });

  next();
};
```

## 🧪 Testing Best Practices

### Unit Testing

```typescript
describe('UserService', () => {
  let userService: UserService;
  let userRepository: MockUserRepository;

  beforeEach(() => {
    userRepository = new MockUserRepository();
    userService = new UserService(userRepository);
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = { name: 'John Doe', email: 'john@example.com' };
      userRepository.create.mockResolvedValue({ id: '123', ...userData });

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result.id).toBe('123');
      expect(userRepository.create).toHaveBeenCalledWith(userData);
    });

    it('should throw error for invalid email', async () => {
      // Arrange
      const userData = { name: 'John Doe', email: 'invalid-email' };

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Testing

```typescript
describe('User API Integration', () => {
  let app: Express;
  let db: Database;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await setupTestApp();
  });

  afterAll(async () => {
    await db.cleanup();
  });

  describe('POST /api/users', () => {
    it('should create user and return 201', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining(userData)
      });
    });
  });
});
```

## 🚀 Deployment Guidelines

### Pre-deployment Checklist

- [ ] All tests passing
- [ ] Code coverage above 80%
- [ ] No linting errors
- [ ] TypeScript compilation successful
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] Documentation updated

### Deployment Commands

```bash
# Staging deployment
./scripts/deploy.sh --environment staging --branch develop

# Production deployment
./scripts/deploy.sh --environment production --branch main --tag v1.0.0

# Docker deployment
./scripts/deploy-docker.sh --environment production --push
```

### Post-deployment Verification

```bash
# Health check
curl https://yourapp.com/health

# Database connectivity
curl https://yourapp.com/health/database

# API functionality
curl https://yourapp.com/api/users
```

## 📚 Additional Resources

### Learning Resources

- **[Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)**
- **[Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)**
- **[MongoDB Performance](https://docs.mongodb.com/manual/administration/performance-tuning/)**
- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**

### Tools & Libraries

- **Validation**: Joi, Yup, Zod
- **Testing**: Jest, Supertest, Cypress
- **Documentation**: TypeDoc, Swagger/OpenAPI
- **Monitoring**: Winston, Pino, New Relic
- **Security**: Helmet, CORS, Rate limiting

---

**Happy coding!** 🎉 Remember to follow these guidelines to maintain code quality and consistency across the project.