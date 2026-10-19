FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY db/migrations ./db/migrations
COPY scripts/migrate.mjs scripts/create-owner.mjs ./scripts/

EXPOSE 3001
CMD ["sh", "-c", "npm run db:migrate && npm run api:start"]
