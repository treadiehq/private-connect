FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate

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

# Create data directory
RUN mkdir -p /app/data

# Initialize database
ENV DATABASE_URL="file:/app/data/dev.db"
RUN pnpm db:push

EXPOSE 3001
EXPOSE 23000-23100

CMD ["node", "dist/main"]

