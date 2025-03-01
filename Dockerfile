FROM ghcr.io/puppeteer/puppeteer:24.3.0

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Set the correct executable path for Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Start the application
CMD ["node", "index.js"]