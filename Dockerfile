FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY backend/prisma ./backend/prisma

RUN npm ci

COPY . .

RUN npm run prisma:generate --workspace=backend
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY backend/prisma ./backend/prisma

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push --schema=backend/prisma/schema.prisma && node backend/dist/index.js"]
