# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer-cached unless package.json changes)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source and config
COPY tsconfig*.json ./
COPY esbuild-contracts.mjs ./
COPY genesis.config.json ./
COPY network.config.json ./
COPY src/ ./src/

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime (lean image, no dev tooling)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Only copy production artefacts
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY genesis.config.json ./
COPY network.config.json ./

# Persistent data directories (mount volumes to these paths)
RUN mkdir -p data wallets logs

# ─── Ports ───────────────────────────────────────────────────────────────────
# 3001 → REST API
# 6001 → P2P WebSocket
EXPOSE 3001 6001

# ─── Environment variables (customize at runtime) ────────────────────────────
# API_KEY          Required. Secret key for the REST API.
# MINER_ADDRESS    Optional. Validator address to receive block rewards.
# PEERS            Optional. Comma-separated list of seed peer URLs.
# P2P_TLS_CERT     Optional. Path to PEM TLS certificate for wss:// mode.
# P2P_TLS_KEY      Optional. Path to PEM private key for wss:// mode.
ENV NODE_ENV=production \
    API_KEY="" \
    MINER_ADDRESS="" \
    PEERS=""

# Healthcheck — query the /status endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- --header="x-api-key:${API_KEY}" http://localhost:3001/status || exit 1

CMD ["node", "--trace-warnings", "dist/node.js"]
