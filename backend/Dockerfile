FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build
# Compile the seed script so it can be run without ts-node in production
RUN npx tsc --outDir dist --module commonjs --target ES2021 --esModuleInterop true \
    --experimentalDecorators true --emitDecoratorMetadata true \
    --skipLibCheck true prisma/seed.ts

FROM node:20-alpine AS production

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

RUN apk add --no-cache openssl

EXPOSE 3000

CMD sh -c "npx prisma migrate deploy && node dist/prisma/seed.js && node dist/src/main"
