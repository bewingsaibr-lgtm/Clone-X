# ─────────────────────────────────────────────────────────────
# SwitchX Clone – Frontend Dockerfile
# Build React app, serve with Nginx
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_BACKEND_URL=http://localhost:3001
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Nginx ────────────────────────────────────────────
FROM nginx:alpine AS production

# Custom nginx config for SPA routing
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy to backend
    location /api/ {
        proxy_pass http://backend:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /outputs/ {
        proxy_pass http://backend:3001/outputs/;
    }

    location /socket.io/ {
        proxy_pass http://backend:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
EOF

COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
