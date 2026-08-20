# ==========================================
# Stage 1: Build the Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend config and package files
COPY frontend/package*.json ./
RUN npm install

# Copy source and build static assets
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Setup the Runner
# ==========================================
FROM node:20-alpine AS runner
WORKDIR /app

# Copy root configurations (if needed)
COPY package*.json ./

# Copy backend config and package files
COPY backend/package*.json ./backend/
RUN cd backend && npm install --only=production

# Copy backend files
COPY backend/ ./backend/

# Copy built frontend assets from Stage 1 into the place Express serves them
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose server port (Express default is 5000, Render/Heroku injects PORT env)
EXPOSE 5000
ENV PORT=5000

# Start server
CMD ["node", "backend/server.js"]
