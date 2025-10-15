# 🤝 Contributing to HubSpot-NetSuite Simulator

Thank you for your interest in contributing to the HubSpot-NetSuite Simulator! This document provides guidelines for contributing to the project.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Community Guidelines](#community-guidelines)

## 🚀 Getting Started

### Prerequisites

- **Node.js 24.x** (recommended) or 22.x
- **npm** for package management
- **Git** for version control
- **TypeScript** knowledge
- **Jest** testing framework familiarity

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/hubspot-netsuite-simulator.git
   cd hubspot-netsuite-simulator
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment**:
   ```bash
   cp env/.env.development .env
   # Edit .env with your configuration
   ```

5. **Run tests**:
   ```bash
   npm test
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

### Project Structure

```
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/         # Data models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── types/          # TypeScript definitions
├── tests/              # Test files
├── scripts/            # Deployment scripts
├── env/                # Environment configurations
├── .github/           # GitHub Actions workflows
└── docs/              # Documentation
```

## 🔄 Development Workflow

### Branch Strategy

We use a **feature-branch workflow**:

- **`main`** - Production-ready code
- **`develop`** - Integration branch for features
- **`feature/*`** - New features
- **`bugfix/*`** - Bug fixes
- **`hotfix/*`** - Critical production fixes

### Creating a Feature Branch

```bash
# Create and switch to new feature branch
git checkout -b feature/amazing-new-feature

# Or for bug fixes
git checkout -b bugfix/issue-description
```

### Development Process

1. **Create feature branch** from `develop`
2. **Make changes** following code standards
3. **Write tests** for new functionality
4. **Run tests** locally: `npm test`
5. **Update documentation** if needed
6. **Commit changes** with clear messages
7. **Push branch** and create Pull Request

## 📝 Code Standards

### TypeScript Guidelines

- **Use strict mode**: Always enable TypeScript strict checks
- **Interface over type**: Prefer interfaces for object definitions
- **Generic constraints**: Use generics for reusable components
- **Enum alternatives**: Prefer union types over enums

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

type UserStatus = 'active' | 'inactive' | 'pending';

// ❌ Avoid
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}
```

### Naming Conventions

- **Files**: `kebab-case` (e.g., `user-service.ts`)
- **Classes**: `PascalCase` (e.g., `UserService`)
- **Functions**: `camelCase` (e.g., `getUserById`)
- **Variables**: `camelCase` (e.g., `userName`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
- **Interfaces**: `PascalCase` with 'I' prefix (e.g., `IUser`)
- **Types**: `PascalCase` (e.g., `UserStatus`)

### Code Style

- **Indentation**: 2 spaces (no tabs)
- **Line length**: 100 characters maximum
- **Semicolons**: Required
- **Trailing commas**: Prefer in multiline objects
- **Quotes**: Single quotes for strings

```typescript
// ✅ Good
class ExampleService {
  private readonly MAX_RETRIES = 3;

  async processUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}

// ❌ Avoid
class example_service {
  async process_user(user_id) {
    // ...
  }
}
```

### Error Handling

- **Always handle errors**: Never leave promises unhandled
- **Specific error types**: Create custom error classes
- **Error context**: Include relevant information in errors
- **Logging**: Log errors appropriately

```typescript
// ✅ Good
class CustomError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'CustomError';
  }
}

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error, {
    operation: 'riskyOperation',
    userId,
  });
  throw new CustomError('Operation failed', 'OPERATION_FAILED', 500);
}
```

## 🧪 Testing Guidelines

### Testing Structure

- **Unit Tests**: Test individual functions/classes
- **Integration Tests**: Test service interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Test under load

### Test Naming

```typescript
// ✅ Good
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', () => {
      // Test implementation
    });

    it('should throw error for invalid email', () => {
      // Test implementation
    });
  });
});

// ❌ Avoid
describe('UserService', () => {
  it('works', () => {
    // Vague test name
  });
});
```

### Test Coverage

- **Minimum 80% coverage** for new code
- **Critical paths**: 100% coverage required
- **Error scenarios**: Must test error conditions
- **Edge cases**: Test boundary conditions

```bash
# Run tests with coverage
npm test -- --coverage

# Check coverage thresholds
npm run test:coverage
```

## 🔀 Pull Request Process

### PR Requirements

- **Clear title**: Summarize the changes
- **Detailed description**: Explain what, why, and how
- **Tests included**: All new features must have tests
- **Documentation updated**: Update README if needed
- **CI passing**: All GitHub Actions must pass

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows project standards
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Security considerations addressed
- [ ] Performance impact assessed
```

### Code Review Process

1. **Automated checks** run first (GitHub Actions)
2. **Maintainers review** code for standards compliance
3. **Feedback provided** with specific suggestions
4. **Changes requested** if issues found
5. **Approval** when all requirements met
6. **Merge** to target branch

## 🐛 Issue Reporting

### Bug Reports

**Required Information:**
- **Description**: Clear description of the bug
- **Steps to reproduce**: Step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Node.js version, OS, etc.
- **Error logs**: Relevant error messages

### Feature Requests

**Required Information:**
- **Problem statement**: What problem does this solve?
- **Proposed solution**: How should it work?
- **Alternatives considered**: Other approaches evaluated
- **Additional context**: Screenshots, examples, etc.

### Issue Template

```markdown
## Issue Type
- [ ] Bug Report
- [ ] Feature Request
- [ ] Improvement
- [ ] Documentation
- [ ] Question

## Description
[Clear description of the issue]

## Steps to Reproduce (Bug Reports)
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Node.js Version:
- OS:
- Package Version:

## Additional Context
[Any additional information]
```

## 💬 Community Guidelines

### Communication

- **Be respectful**: Treat everyone with respect
- **Be constructive**: Focus on solutions, not problems
- **Be collaborative**: Work together to improve the project
- **Be patient**: Good contributions take time to review

### Code of Conduct

1. **No harassment**: Zero tolerance for harassment
2. **Inclusive language**: Use inclusive and welcoming language
3. **Constructive feedback**: Provide feedback that helps improve
4. **Credit contributions**: Acknowledge others' work

### Getting Help

- **Check documentation** first
- **Search existing issues** before creating new ones
- **Ask questions** in discussions or issues
- **Provide context** when asking for help

## 🔧 Development Tools

### Recommended Tools

- **Editor**: VS Code with TypeScript support
- **Linting**: ESLint + Prettier
- **Testing**: Jest + Supertest
- **API Testing**: Postman or Insomnia
- **Git GUI**: GitHub Desktop or VS Code Git integration

### VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "ms-vscode.vscode-eslint"
  ]
}
```

## 📚 Additional Resources

### Documentation

- **[API Documentation](./docs/api.md)** - API endpoint documentation
- **[Deployment Guide](./scripts/README.md)** - Deployment instructions
- **[GitHub Actions Guide](./.github/README.md)** - CI/CD documentation

### External Resources

- **[TypeScript Handbook](https://www.typescriptlang.org/docs/)**
- **[Express.js Guide](https://expressjs.com/)**
- **[Jest Documentation](https://jestjs.io/docs/getting-started)**
- **[Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)**

## 🎉 Recognition

Contributors are recognized for their efforts:

- **Code contributions** merged into main branch
- **Documentation improvements**
- **Bug reports** and feature requests
- **Community support** and help

---

## 📞 Contact

- **Issues**: Use GitHub Issues for bug reports and features
- **Discussions**: Use GitHub Discussions for questions and ideas
- **Email**: For sensitive matters or direct contact

**Thank you for contributing!** Your help makes this project better for everyone. 🌟