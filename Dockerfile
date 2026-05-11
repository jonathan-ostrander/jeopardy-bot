# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies first (cached layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy and install client dependencies (cached layer)
COPY src/activity/client/package.json src/activity/client/package-lock.json ./src/activity/client/
RUN cd src/activity/client && bun install

# Development stage - uses volume mounts for hot reload
FROM base as development
WORKDIR /usr/src/app

# Copy source code (will be overlaid by volume mount at runtime, but needed for build)
COPY . .

# Build the client initially
RUN cd src/activity/client && bun run build

# Install fontconfig for custom fonts
RUN apt-get update && apt-get install -y fontconfig && rm -rf /var/lib/apt/lists/*
COPY fonts/ /usr/share/fonts/
RUN fc-cache -fv

# Create data directories
RUN mkdir -p src/shared/data/categories/jeopardy \
    src/shared/data/categories/double_jeopardy \
    src/shared/data/categories/final_jeopardy \
    src/shared/data/games

ENV NODE_ENV=development
ENV ANSWER_SIMILARITY_THRESHOLD=0.8

# Use bun --watch for hot reload
CMD ["bun", "--watch", "run", "src/server.ts"]

# Build stage - compiles everything
FROM base as build
WORKDIR /usr/src/app

# Copy source code
COPY . .

# Build the client
RUN cd src/activity/client && npm run build

# Build the server
RUN bun run build:server

# Production stage - minimal image
FROM oven/bun:1-slim as production
WORKDIR /usr/src/app

# Install fontconfig for custom fonts
RUN apt-get update && apt-get install -y fontconfig && rm -rf /var/lib/apt/lists/*
COPY fonts/ /usr/share/fonts/
RUN fc-cache -fv

# Copy built files and dependencies
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./
COPY --from=build /usr/src/app/src/shared/data ./src/shared/data

# Create data directories
RUN mkdir -p src/shared/data/categories/jeopardy \
    src/shared/data/categories/double_jeopardy \
    src/shared/data/categories/final_jeopardy \
    src/shared/data/games

ENV NODE_ENV=production
ENV ANSWER_SIMILARITY_THRESHOLD=0.8

# Run the server
CMD ["bun", "run", "dist/server.js"]
