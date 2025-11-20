# Hacknest

A lightweight, Web3-native platform for hackathons and grants with on-chain payout orchestration.

## 🎯 Overview

Hacknest enables communities to host hackathons and grant programs with wallet-based authentication, submission management, judging workflows, and automated on-chain payouts. Built for transparency, security, and developer experience.

## ✨ Key Features

- 🔐 **Wallet-Based Authentication** - Sign in with Ethereum wallet (EIP-191)
- 🎪 **Event Management** - Create and manage hackathons/grants
- 📝 **Verified Submissions** - Signature-verified project submissions
- ⚖️ **Judging System** - Role-based scoring and winner selection
- 💰 **On-Chain Payouts** - Automated prize distribution via smart contracts
- 🔒 **Multi-Sig Escrow** - Secure prize pool management with multi-signature approvals
- 🔐 **Security First** - Role-based access control, input validation, audit logging
- 📚 **API Documentation** - Auto-generated Swagger/OpenAPI docs

## 💎 Smart Contract - PrizePoolEscrow

**Network**: Base (Chain ID: 8453)  
**Contract Address**: `0xFe3989D74711b1dda30cf4a52F3DE14392185097`  
**Block Explorer**: [View on BaseScan](https://basescan.org/address/0xFe3989D74711b1dda30cf4a52F3DE14392185097)

### Features

- 🔐 **Multi-Signature Security** - Requires multiple judge approvals for payouts (minimum 2 signatures)
- 💰 **Dual Token Support** - Works with native ETH and ERC20 tokens
- 🎭 **Role-Based Access** - HOST_ROLE, JUDGE_ROLE, and ADMIN_ROLE separation
- 🔒 **ReentrancyGuard** - Protection against reentrancy attacks
- ⏰ **Emergency Timelock** - 7-day delay on emergency withdrawals
- 🛑 **Pausable** - Can be paused in emergency situations
- 📦 **Batch Payouts** - Distribute prizes to up to 50 winners at once
- 💳 **Refund Mechanism** - Hosts can refund pools if no payouts are made

### Pool Management

**Create Prize Pool**:
```typescript
import { PRIZE_POOL_ESCROW_ADDRESS, PRIZE_POOL_ESCROW_ABI } from './abi';

// Create pool with native ETH
const poolId = await contract.createPrizePool(
  eventId,
  '0x0000000000000000000000000000000000000000', // address(0) for ETH
  2, // required signatures
  { value: prizeAmount }
);

// Create pool with ERC20 token
const poolId = await contract.createPrizePool(
  eventId,
  tokenAddress,
  3 // required signatures
);
```

**Request Payout**:
```typescript
const payoutId = await contract.requestPayout(
  poolId,
  [winner1, winner2, winner3], // recipient addresses
  [amount1, amount2, amount3],  // prize amounts
  "Hackathon Winners - Round 1"
);
```

**Approve Payout** (Judge):
```typescript
// Judges approve the payout
await contract.approvePayout(payoutId);
// Auto-executes when required signatures are reached
```

### Pool Status States

- **Active** (0) - Pool is open for funding and payouts
- **Locked** (1) - Pool is locked, no new funding allowed
- **Completed** (2) - All funds distributed
- **Cancelled** (3) - Pool cancelled or emergency withdrawn

### Payout Status States

- **Pending** (0) - Awaiting judge approvals
- **Approved** (1) - Approved but not executed
- **Executed** (2) - Successfully paid out
- **Rejected** (3) - Rejected by admin

### Security Features

✅ **Multi-Sig Required**: Minimum 2 signatures needed for payouts  
✅ **Role Separation**: Host creates pools, Judges approve, Admins manage  
✅ **Time-Locked Emergency**: 7-day delay on emergency withdrawals  
✅ **Refund Protection**: Only refundable if no payouts have been made  
✅ **Batch Size Limit**: Maximum 50 recipients per payout  
✅ **Comprehensive Events**: Full audit trail for all operations

### Integration

```typescript
import { 
  PRIZE_POOL_ESCROW_ADDRESS, 
  PRIZE_POOL_ESCROW_ABI,
  PoolStatus,
  PayoutStatus,
  ROLES,
  CONTRACT_CONSTANTS
} from './abi';

// View pool details
const poolDetails = await contract.getPoolDetails(poolId);
console.log(`Remaining: ${poolDetails.remainingAmount}`);
console.log(`Status: ${PoolStatus[poolDetails.status]}`);

// View event winners
const winners = await contract.getEventWinners(eventId);
```

See [`abi.ts`](./abi.ts) for complete contract ABI and configuration.

## 🏗️ Repository Structure

```
hacknest-backend/
├── backend/                      # NestJS Backend Application
│   ├── src/
│   │   ├── auth/                # Wallet authentication & JWT
│   │   ├── users/               # User management
│   │   ├── events/              # Event CRUD operations
│   │   ├── submissions/         # Submission handling
│   │   ├── judging/             # Scoring & winner selection
│   │   ├── jobs/                # Payout job queue
│   │   ├── web3/                # Smart contract integration
│   │   └── common/              # Shared utilities
│   ├── test/                    # Unit & E2E tests
│   ├── Dockerfile               # Production Docker image
│   ├── docker-compose.yml       # Local development setup
│   └── README.md                # Backend documentation
├── .github/workflows/           # CI/CD pipelines
└── IMPLEMENTATION_SUMMARY.md    # Technical implementation details
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Ethereum RPC endpoint (e.g., Base, Sepolia)

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

The API will be available at:
- **API**: http://localhost:4000/api
- **Swagger Docs**: http://localhost:4000/api/docs
- **Health Check**: http://localhost:4000/api/health

### Using Docker

```bash
cd backend

# Start all services (app + MongoDB)
docker-compose up

# Access API at http://localhost:4000/api
```

## 📖 Documentation

- **[Backend README](./backend/README.md)** - Complete backend setup and API documentation
- **[Judge Management Guide](./backend/JUDGE_MANAGEMENT.md)** - Guide for inviting and managing judges
- **[WalletConnect Integration](./backend/WALLETCONNECT_INTEGRATION.md)** - Frontend WalletConnect setup guide
- **[WalletConnect Backend](./backend/WALLETCONNECT_BACKEND_GUIDE.md)** - Backend session management & monitoring
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Technical architecture and design decisions
- **[API Documentation](http://localhost:4000/api/docs)** - Interactive Swagger docs (when running)

## 🛠️ Technology Stack

### Backend
- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: MongoDB with Mongoose
- **Blockchain**: ethers.js v5.7.2
- **Authentication**: JWT with wallet signatures
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Package Manager**: npm

## 🔑 Core API Endpoints

### Authentication
```http
GET  /api/auth/nonce?address=0x...    # Request nonce
POST /api/auth/login                   # Login with signature
```

### Events
```http
POST   /api/events                          # Create event (Host)
GET    /api/events                          # List events (Public)
GET    /api/events/:id                      # Event details (Public)
POST   /api/events/:id/judges/invite        # Invite judges (Host)
DELETE /api/events/:id/judges               # Remove judge (Host)
GET    /api/events/:id/judges               # List judges (Public)
```

### Submissions
```http
POST /api/events/:id/submissions              # Submit project
GET  /api/events/:id/submissions              # List submissions
```

### Judging
```http
POST /api/events/:id/submissions/:sid/score   # Score submission (Judge)
POST /api/events/:id/payout                    # Trigger payout (Host)
```

## 🧪 Testing

```bash
cd backend

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Generate coverage report
npm run test:cov
```

## 🔒 Security Features

- ✅ Wallet signature verification (EIP-191)
- ✅ JWT token authentication (7-day expiry)
- ✅ Role-based access control (Host, Judge, Participant)
- ✅ Input validation with class-validator
- ✅ Nonce-based replay protection (10-minute TTL)
- ✅ Secure private key handling
- ✅ Comprehensive audit logging

## 🚢 Deployment

### Environment Variables

Required configuration (see `.env.example`):

```bash
PORT=4000
NODE_ENV=production
MONGO_URI=mongodb://...
JWT_SECRET=your-secret-key
ETH_PROVIDER_URL=https://rpc.base.org
CHAIN_ID=8453
PRIVATE_KEY=0x...  # Use secret manager in production
EVENT_FACTORY_ADDRESS=0x...
```

### CI/CD

GitHub Actions workflows included:
- **CI**: Lint, test, and validate on push/PR
- **Deploy**: Build and push Docker image on version tags

```bash
# Trigger deployment
git tag v1.0.0
git push origin v1.0.0
```

## 📊 Architecture

```
┌─────────────┐
│   Client    │
│  (Wallet)   │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────┐
│     NestJS REST API             │
│  ┌─────────┬──────────┬──────┐ │
│  │  Auth   │  Events  │ Jobs │ │
│  │ Service │ Service  │Queue │ │
│  └─────────┴──────────┴──────┘ │
└────────┬──────────────┬─────────┘
         │              │
         ↓              ↓
    ┌─────────┐   ┌──────────┐
    │ MongoDB │   │ Ethereum │
    │         │   │   RPC    │
    └─────────┘   └──────────┘
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and add tests
4. Run linter and tests: `npm run lint && npm run test`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feat/my-feature`
7. Open a Pull Request

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier configured
- Follow existing patterns and conventions

## 📝 License

MIT License - see [LICENSE](./LICENSE) file for details

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/hacknest/issues)
- **Security**: Report vulnerabilities via GitHub Security Advisories
- **Maintainers**: Hacknest Team

---

**Status**: ✅ Production Ready

Built with ❤️ for the Web3 community
