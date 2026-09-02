# Multi-stage build for lightweight, secure production image
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code and configuration files
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server.ts ./

# Build production frontend (dist/index.html, dist/assets) and server (dist/server.cjs)
RUN npm run build

# --- Production Runner Stage ---
FROM node:20-alpine AS runner

WORKDIR /app

# Install curl for reliable Coolify healthchecks
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled bundles from builder stage (contains frontend dist and server.cjs)
COPY --from=builder /app/dist ./dist

# Expose web server port
EXPOSE 3000

# Start the application
CMD ["node", "dist/server.cjs"]
