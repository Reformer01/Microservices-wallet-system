# Microservice-Based Wallet System

The project follows a monorepo structure:
- `apps/user-service`: Manages user data and provides gRPC endpoints.
- `apps/wallet-service`: Manages wallet balances, communicates with `user-service` via gRPC.
- `apps/gateway`: A REST API gateway that communicates with the microservices via gRPC.
- `packages/proto`: Contains gRPC protocol buffer definitions.
- `packages/prisma`: Contains the Prisma schema and migrations.

## Requirements

- Node.js (v18+)
- PostgreSQL (or SQLite for local testing)
- gRPC

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Configuration**:
   Create a `.env` file in the root directory and add your PostgreSQL connection string:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/wallet_db"
   ```

3. **Run Migrations**:
   ```bash
   npm run prisma:migrate
   ```

4. **Generate Prisma Client**:
   ```bash
   npm run prisma:generate
   ```

## Running the Services

To start all services (User Service, Wallet Service, and Gateway) in parallel:
```bash
npm run dev
```

The Gateway will be available at `http://localhost:3000`.

## API Endpoints (REST Gateway)

### 1. Create User
- **URL**: `POST /users`
- **Body**:
  ```json
  {
    "email": "john@example.com",
    "name": "John Doe"
  }
  ```

### 2. Get User
- **URL**: `GET /users/:id`

### 3. Create Wallet
- **URL**: `POST /wallets`
- **Body**:
  ```json
  {
    "userId": "user-uuid"
  }
  ```

### 4. Get Wallet
- **URL**: `GET /wallets/:userId`

### 5. Credit Wallet
- **URL**: `POST /wallets/credit`
- **Body**:
  ```json
  {
    "userId": "user-uuid",
    "amount": 100.0
  }
  ```

### 6. Debit Wallet
- **URL**: `POST /wallets/debit`
- **Body**:
  ```json
  {
    "userId": "user-uuid",
    "amount": 50.0
  }
  ```

## Features & Bonus Points

- **gRPC Communication**: Services communicate using high-performance gRPC.
- **Inter-Service Verification**: Wallet Service verifies user existence via User Service before creating a wallet.
- **Transactions**: Debiting uses Prisma `$transaction` to ensure data integrity and prevent overdrafts.
- **Validation**: Input validation implemented using `class-validator` in the Gateway.
- **Error Handling**: Robust error handling with specific gRPC status codes (NOT_FOUND, ALREADY_EXISTS, FAILED_PRECONDITION).
- **Logging**: Structured logging implemented using `nestjs-pino` and `pino-pretty` for better observability.
- **Monorepo Structure**: Organized into `apps/` and `packages/` for scalability.

## Testing with Curl

**Create User**:
```bash
curl -X POST http://localhost:3000/users -H "Content-Type: application/json" -d '{"email": "test@test.com", "name": "Test User"}'
```

**Create Wallet**:
```bash
curl -X POST http://localhost:3000/wallets -H "Content-Type: application/json" -d '{"userId": "REPLACE_WITH_USER_ID"}'
```

**Credit Wallet**:
```bash
curl -X POST http://localhost:3000/wallets/credit -H "Content-Type: application/json" -d '{"userId": "REPLACE_WITH_USER_ID", "amount": 100}'
```

**Debit Wallet**:
```bash
curl -X POST http://localhost:3000/wallets/debit -H "Content-Type: application/json" -d '{"userId": "REPLACE_WITH_USER_ID", "amount": 50}'
```
