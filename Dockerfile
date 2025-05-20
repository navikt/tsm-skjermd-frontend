# Use the official Node.js image from Docker Hub
FROM node:24-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first for better caching
COPY package.json package-lock.json ./

# GitHub NAV-pakker krever autentisering
RUN --mount=type=secret,id=NODE_AUTH_TOKEN sh -c \
    'npm config set //npm.pkg.github.com/:_authToken=$(cat /run/secrets/NODE_AUTH_TOKEN)'
RUN npm config set @navikt:registry=https://npm.pkg.github.com

# Install dependencies
RUN npm install

# Copy the rest of your source files
COPY . .

# Build the application
RUN npm run build

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]