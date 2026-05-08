# Use the official Bun image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN bun run build

# Production image
FROM oven/bun:1-slim
WORKDIR /usr/src/app

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

# Run the bot
CMD ["bun", "run", "dist/bot/index.js"]
