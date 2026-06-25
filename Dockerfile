FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js db.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3853
ENV DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 3853

CMD ["node", "server.js"]