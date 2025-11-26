# Use Node.js 18 base image
FROM node:18-slim

# Install ffmpeg and ffprobe
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for TypeScript)
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port (Railway will set PORT automatically)
EXPOSE 4001

# Start the application
CMD ["npm", "start"]

