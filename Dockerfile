FROM node:20-slim AS build

# argon2 may need a local toolchain when a matching prebuilt binary is not available.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN npm --prefix backend ci --include=dev \
    && npm --prefix backend run prisma:generate \
    && npm --prefix backend run build:release

FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
ENV NODE_ENV=production

COPY backend/package.json backend/package-lock.json ./
COPY backend/prisma ./prisma
RUN npm ci --include=dev \
    && npm run prisma:generate \
    && npm cache clean --force

COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/public ./public

EXPOSE 10000
CMD ["sh", "-c", "npm run prisma:deploy && npm run start"]
