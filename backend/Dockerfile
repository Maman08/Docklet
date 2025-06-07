
FROM node:18-alpine

RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    docker-cli

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY scripts/ ./scripts/
RUN chmod +x scripts/*.sh

RUN mkdir -p uploads outputs logs

# For development, we'll run as root to avoid Docker socket permission issues
# In production, you should use proper user management or Docker-in-Docker alternatives

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

CMD ["npm", "start"]