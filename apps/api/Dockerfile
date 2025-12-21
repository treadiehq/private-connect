FROM node:20-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.1 --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Generate Prisma client
RUN pnpm db:generate

# Copy source
COPY . .

# Build
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install OpenSSL for Prisma and pnpm for commands
RUN apk add --no-cache openssl && \
    corepack enable && corepack prepare pnpm@9.15.1 --activate

# Copy built assets and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# Environment
ENV NODE_ENV=production
ENV PORT=3001

# Start command: run migrations then start the server
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
