FROM node:20-slim

# argon2 has no prebuilt binary for this platform, so node-gyp needs to
# compile it from source at install time.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 10000 4000

CMD ["node", "dist/server.js"]
