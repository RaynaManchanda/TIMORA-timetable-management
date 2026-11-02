# TIMORA API image.
#
# On start it applies the Prisma migrations to PostgreSQL, loads the college workbook from
# data/ (only when that exact file has not been imported yet) and starts the server.

FROM node:20-alpine

# Prisma's engines need OpenSSL.
RUN apk add --no-cache openssl

WORKDIR /app

# Install production dependencies first so Docker can cache this layer. The Prisma schema is
# copied before "npm ci" because the client is generated from it.
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

COPY server.js ./
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY data/ ./data/
COPY public/ ./public/
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV PORT=3000
ENV NODE_ENV=production

# Run as the unprivileged user that ships with the node image.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
