# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the client (React app)
WORKDIR /usr/src/app/src/activity/client
RUN bun install
RUN bun run build

# Build the server
WORKDIR /usr/src/app
RUN bun run build:server

# Production image
FROM oven/bun:1-slim
WORKDIR /usr/src/app

# Install fontconfig for custom fonts and register ITC Korinna
RUN apt-get update && apt-get install -y fontconfig && rm -rf /var/lib/apt/lists/*
COPY fonts/ /usr/share/fonts/
RUN fc-cache -fv

# Copy built files and dependencies
COPY --from=base /usr/src/app/dist ./dist
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY --from=base /usr/src/app/package.json ./
COPY --from=base /usr/src/app/src/shared/data ./src/shared/data

# Create data directories
RUN mkdir -p src/shared/data/categories/jeopardy \
    src/shared/data/categories/double_jeopardy \
    src/shared/data/categories/final_jeopardy \
    src/shared/data/games

# Environment variables
ENV NODE_ENV=production
ENV ANSWER_SIMILARITY_THRESHOLD=0.8

# Run the server
CMD ["bun", "run", "dist/server.js"]
