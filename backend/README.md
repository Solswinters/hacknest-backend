# Hacknest Backend

Backend for Hacknest — lightweight Web3-native hackathon & grant hosting platform.
Built with NestJS, TypeScript, MongoDB, and ethers.js for on-chain interactions.

## 🏗️ Architecture

- **NestJS** REST API with modular architecture
- **MongoDB** with Mongoose for data persistence
- **ethers.js** (v5) for blockchain interactions
- **JWT** for wallet-based authentication
- **Simple job queue** for payout processing (DB-based, no Redis)

## ✨ Features

- Wallet-based authentication (nonce + signature → JWT)
- Event lifecycle management (create, list, view)
- Participant submissions with signature verification
- Judging system with role-based access control
- Payout orchestration via contract service
- Comprehensive test coverage (unit + E2E)
- Production-ready Docker setup
- CI/CD with GitHub Actions

## 📋 Prerequisites

- Node.js 20+
- npm (included with Node.js)
- MongoDB (local or Atlas)
- Ethereum RPC URL (e.g., Base RPC)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` and create `.env`:

```bash
# Server
PORT=4000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/hacknest

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-me
JWT_EXP=7d

# Web3
ETH_PROVIDER_URL=https://rpc.base.org
CHAIN_ID=8453
PRIVATE_KEY=0x...  # DO NOT COMMIT - use vault in production

# Contracts
EVENT_FACTORY_ADDRESS=0x...
```

### 3. Run Development Server

```bash
npm run dev
```

API will be available at `http://localhost:4000/api`

Swagger documentation: `http://localhost:4000/api/docs`

### 4. Seed Development Data (Optional)

```bash
npm run seed
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🐳 Docker

### Development with Docker Compose

```bash
# Start all services (app + MongoDB)
docker-compose up

# Build and start in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Docker Build

```bash
# Build image
docker build -t hacknest-backend .

# Run container
docker run -p 4000:4000 \
  -e MONGO_URI=mongodb://mongo:27017/hacknest \
  -e JWT_SECRET=your-secret \
  hacknest-backend
```

## 📚 API Endpoints

### Authentication

- `GET /api/auth/nonce?address=0x...` - Request nonce for signing
- `POST /api/auth/login` - Login with signed message

### Users

- `GET /api/users/me` - Get current user profile (authenticated)

### Events

- `POST /api/events` - Create event (host only)
- `GET /api/events` - List all events (public)
- `GET /api/events/:id` - Get event details (public)

### Submissions

- `POST /api/events/:eventId/submissions` - Submit to event (authenticated)
- `GET /api/events/:eventId/submissions` - List submissions

### Judging

- `POST /api/events/:eventId/submissions/:submissionId/score` - Score submission (judge/host)

### Jobs

- `POST /api/events/:eventId/payout` - Trigger payout (host)
- `POST /api/jobs/process-payouts` - Process pending payouts (host)
- `GET /api/jobs/:jobId` - Get job status

### Health

- `GET /api/health` - System health check

## 🔐 Security Considerations

1. **Never commit private keys** - Use environment variables and secret managers
2. **Rotate JWT secrets** regularly in production
3. **Use HTTPS** in production environments
4. **Enable CORS** only for trusted origins
5. **Rate limit** sensitive endpoints (nonce generation, login)
6. **Monitor** failed authentication attempts
7. **Audit trail** - all state transitions are logged

## 🛠️ Development

### Project Structure

```
backend/
├── src/
│   ├── auth/           # Authentication & authorization
│   ├── users/          # User management
│   ├── events/         # Event CRUD operations
│   ├── submissions/    # Submission handling
│   ├── judging/        # Scoring & winner selection
│   ├── jobs/           # Payout job queue
│   ├── web3/           # Contract interactions
│   ├── common/         # Shared utilities
│   ├── config/         # Configuration
│   ├── app.module.ts   # Root module
│   └── main.ts         # Application entry point
├── test/               # E2E tests
├── scripts/            # Utility scripts (seed, etc.)
└── package.json
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## 🚢 Deployment

### Environment Variables (Production)

Set these in your deployment environment:

- `MONGO_URI` - Production MongoDB connection string
- `JWT_SECRET` - Strong random secret (min 32 chars)
- `PRIVATE_KEY` - Securely stored private key (use vault/KMS)
- `ETH_PROVIDER_URL` - Production RPC endpoint
- `EVENT_FACTORY_ADDRESS` - Deployed contract address

### GitHub Actions CI/CD

The project includes two workflows:

1. **CI** (`ci.yml`) - Runs on push/PR
   - Lints code
   - Runs unit tests
   - Runs E2E tests

2. **Deploy** (`deploy.yml`) - Runs on version tags
   - Builds Docker image
   - Pushes to Docker Hub
   - Ready for deployment

To trigger deployment:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Commit: `git commit -am 'Add new feature'`
6. Push: `git push origin feat/my-feature`
7. Open a Pull Request

## 📝 License

MIT License - see LICENSE file for details

## 📧 Support

For issues and questions:
- Open an issue on GitHub
- Contact: security@hacknest.example (for security issues)

---

Built with ❤️ by the Hacknest team

