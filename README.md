Hacknest — Backend README

Backend for Hacknest — lightweight Web3-native hackathon & grant hosting platform.
Built with NestJS, TypeScript, MongoDB, and ethers.js for on-chain interactions.
Purpose: fast, secure APIs for events, submissions, judging, and on-chain payout orchestration.

Table of contents

Architecture Overview

Features (MVP)

Prerequisites

Getting started (local)

Environment variables

Folder structure

API — Endpoints & Examples

Auth & Security

Database Schema (Collections)

Smart contract interactions

Testing

CI / Deployment

Operational notes & security

Contributing

Contact / Maintainers

Architecture Overview

NestJS API (REST) — controllers, services, modules pattern.

MongoDB for persistence (document model for events, submissions, users).

ethers.js to talk to solidity contracts (EventFactory / EventInstance).

JWT session tokens after wallet signature authentication.

Optional job queue (Redis + BullMQ) for payout jobs and background tasks.

Features (MVP)

Wallet-based auth (Reown / WalletConnect) — nonce issuance + signature verification.

Create & manage events (host actions).

Participant submissions (signed).

Judge actions: mark accepted/rejected/winner.

Trigger on-chain payout via contract call (payout job enqueued & executed).

Secure endpoints & role-based guards.

Audit-friendly: emit and store events for every state change.

Prerequisites

Node.js 20+

pnpm or npm (pnpm recommended)

MongoDB (local or Atlas)

Ethereum RPC URL (e.g., Base RPC)

Private key for deployment / contract admin (use secrets manager in production)

Foundry/Hardhat for contract testing (optional)

Getting started (local)

Clone the repo:

git clone git@github.com:<you>/hacknest.git
cd hacknest/backend


Install:

pnpm install
# or
npm install


Create .env from .env.example and fill values (see next section).

Run dev server:

pnpm dev
# or
npm run dev


API runs on http://localhost:4000 by default (see .env).

Environment variables

Create backend/.env (do NOT commit secrets). Example:

# App
PORT=4000
NODE_ENV=development

# Mongo
MONGO_URI=mongodb://localhost:27017/hacknest

# JWT
JWT_SECRET=replace_with_secure_random_string
JWT_EXP=7d

# Web3 / Ethers
ETH_PROVIDER_URL=https://rpc.base.org
CHAIN_ID=8453
PRIVATE_KEY=0x...              # for server-side contract calls (use vault in prod)

# Contracts
EVENT_FACTORY_ADDRESS=0x...

# Optional
REDIS_URL=redis://localhost:6379
BULL_QUEUE_PREFIX=hacknest

Folder structure
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── signature.service.ts
│   │   └── jwt.guard.ts
│   ├── users/
│   ├── events/
│   ├── submissions/
│   ├── judging/
│   ├── web3/
│   │   └── contract.service.ts
│   ├── jobs/                # optional: BullMQ worker & job processors
│   └── common/
│       ├── dto/
│       └── filters/
├── test/
├── Dockerfile
├── package.json
└── tsconfig.json

API — Endpoints & Examples

Base: POST http://localhost:4000/api

Auth

GET /api/auth/nonce?address=0x...
Issue a nonce for a wallet address.

POST /api/auth/login
Body:

{
  "address": "0xabc...",
  "signature": "0xdeadbeef...",
  "nonce": "random-nonce"
}


Response: { "token": "JWT", "user": { ... } }

Events

POST /api/events (Auth: Host)
Create event. Body:

{
  "title":"Demo Hack",
  "description":"Build something",
  "rewardCurrency":"ETH",
  "rewardAmount":"0.1",
  "startDate":"2025-11-20T00:00:00Z",
  "endDate":"2025-11-27T00:00:00Z",
  "judges":["0x...","0x..."]
}


On create, backend calls EventFactory contract to register event and returns eventId.

GET /api/events
List public events.

GET /api/events/:id
Event details and submissions (public page).

Submissions

POST /api/events/:id/submissions (Auth: Participant)
Body:

{
  "title":"My Project",
  "description":"GitHub link",
  "repo":"https://github.com/...",
  "signedMessage":"0x..."   // EIP-191/EIP-712 proof-of-submission
}


GET /api/events/:id/submissions (Auth: Host/Judge or public limited)

Judging

POST /api/events/:id/submissions/:submissionId/score (Auth: Judge)
Body:

{ "status":"accepted" } // accepted | rejected | winner


POST /api/events/:id/payout (Auth: Host)
Schedules payout job; actual on-chain payout executed by worker using server private key or multisig.

Auth & Security
Signature-based login flow

Client requests nonce: GET /api/auth/nonce?address=0x...

Server returns { nonce } stored with TTL (e.g., 10 minutes).

Client signs typed data (EIP-712) or personal message (EIP-191) containing the nonce.

Client POST /api/auth/login with address, signature, nonce.

Server verifies signature with ethers.utils.verifyMessage (or verifyTypedData).

If valid, server issues JWT with minimal claims:

{ "sub":"0xabc...","role":"participant","iat":..., "exp":... }

Role-based guards

Host — can create events, trigger payouts.

Judge — can score and mark winners.

Participant — can submit.
Use NestJS guards to protect routes.

Rate-limiting & input validation

Use class-validator DTOs for strict typing.

Rate-limit sensitive endpoints (e.g., nonce issuance, submissions).

Database Schema (Collections)
users
{
  _id: ObjectId,
  address: string,          // wallet address (lowercase)
  username?: string,
  email?: string,
  profile?: { discord?: string, twitter?: string },
  role: "participant" | "host" | "judge",
  createdAt: Date,
  updatedAt: Date
}

events
{
  _id: ObjectId,
  host: "0x...",
  title: string,
  description: string,
  rewardCurrency: "ETH" | "ERC20",
  rewardAmount: string,
  contractAddress?: string, // EventInstance
  startDate: Date,
  endDate: Date,
  judges: ["0x...", ...],
  status: "draft" | "live" | "closed",
  createdAt: Date
}

submissions
{
  _id: ObjectId,
  eventId: ObjectId,
  participant: "0x...",
  title: string,
  repo?: string,
  url?: string,
  signature: string,
  ipfsHash?: string, // optional for attachments
  status: "submitted" | "accepted" | "rejected" | "winner",
  score?: number,
  createdAt: Date
}

jobs (optional)

Queued payout operations / background tasks.

Smart contract interactions

Use ethers.js provider configured with ETH_PROVIDER_URL.

contract.service.ts encapsulates:

connect (provider + signer using PRIVATE_KEY)

createEvent(host, metadataURI, rewardToken, rewardAmount)

fundEvent(eventAddress, amount)

payout(eventAddress, winners[], amounts[])

Important: Server private key must be secured. For production, prefer a multisig or a backend-less flow where host funds and triggers payouts. Alternatively, use a relayer design with signed instructions.

Testing
Unit & integration

Use Jest (Nest default) for unit tests.

pnpm test runs backend tests.

Contract tests

Use Foundry or Hardhat in contracts/ for solidity tests.

Mock contract responses during backend unit tests (ethers.js MockProvider or sinon).

E2E

Use Supertest to spin up the Nest app and test API flows:

nonce -> signature -> login -> create event -> submission -> judge -> payout scheduling.

CI / Deployment
GitHub Actions (recommended)

ci.yml: lint (ESLint + Prettier), unit tests, contract tests.

deploy.yml: build & push Docker image to registry (for staging/production), deploy backend to Railway/Render, set secrets via repository settings.

Docker

Example Dockerfile:

FROM node:20-alpine
WORKDIR /app
COPY package*.json pnpm-lock.yaml ./
RUN npm ci --production
COPY . .
CMD ["node", "dist/main.js"]

Operational notes & security

Rotate server keys regularly; use HashiCorp Vault or cloud secret manager.

Enforce strict CORS, CSP and XSS protections.

Monitor and alert on suspicious activity (multiple nonce requests, failed signature attempts).

Keep a clear audit trail: every state transition should be persisted with actor wallet and timestamp.

Consider multisig for funds custody; do not have a single server key controlling large sums.

Contributing

Fork the repo.

Create a feature branch: feat/<short-description>.

Run tests & linters locally.

Open a PR with a clear description and test plan.

Code style:

TypeScript strict mode ON

Prettier + ESLint config (share workspace)

Useful snippets
Verify signature (ethers)
import { ethers } from "ethers";

function verifySignature(address: string, message: string, signature: string) {
  const recovered = ethers.utils.verifyMessage(message, signature);
  return recovered.toLowerCase() === address.toLowerCase();
}

Issue nonce (simple)
// store nonce in Redis or Mongo with 10 minute TTL
const nonce = crypto.randomBytes(16).toString("hex");

Example JWT payload
{
  "sub": "0xabc...",
  "role": "host",
  "iat": 1700000000,
  "exp": 1700604800
}

Contact / Maintainers

Repo owner / maintainer: Hacknest Team

For urgent security issues: create a GitHub issue with the security label and email security@hacknest.example (replace with real address in prod).
