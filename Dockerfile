FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy all application files
COPY . .

# Create directory for token storage
RUN mkdir -p /tokens

# Expose port for auth server
EXPOSE 3333

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/tokens

# Create startup script with logging
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'node outlook-auth-server.js > /tokens/auth-server.log 2>&1 &' >> /app/start.sh && \
    echo 'node index.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Run both servers
CMD ["/app/start.sh"]