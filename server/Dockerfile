# Build from the repository root (the server shares the geometry engine with the client):
#   docker build -f server/Dockerfile -t quote-engine-api .
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY server server
COPY client/src/engine client/src/engine
ENV NODE_ENV=production
WORKDIR /app/server
EXPOSE 5000
CMD ["node", "index.js"]
