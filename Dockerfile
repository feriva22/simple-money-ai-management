# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Run the OpenNext build command
RUN npm run build


# Stage 2: Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Copy the built output from the builder stage
COPY --from=builder /app/.open-next .

# Expose the port the app will run on
EXPOSE 3000

# Set the command to start the server
# This command is specific to the OpenNext output structure
CMD [ "node", ".open-next/server-function/index.mjs" ]
