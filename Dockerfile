# Use Node.js official image
FROM node:23-slim

# Set working directory
WORKDIR /app

# Copy root package details
COPY package*.json ./

# Copy frontend package details
COPY frontend/package*.json ./frontend/

# Install backend and frontend dependencies
RUN npm install
RUN npm install --prefix frontend

# Copy the rest of the application files
COPY . .

# Build the frontend assets
RUN npm run build

# Hugging Face Spaces expects the container to run on port 7860
ENV PORT=7860
EXPOSE 7860

# Start the Node.js backend
CMD ["npm", "start"]
