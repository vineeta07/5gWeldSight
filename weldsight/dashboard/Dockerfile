# Build the static site, then serve it with nginx (used by docker-compose)
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=""
ARG VITE_DASHBOARD_URL=""
ARG VITE_SITE_URL=""
ENV VITE_API_URL=$VITE_API_URL VITE_DASHBOARD_URL=$VITE_DASHBOARD_URL VITE_SITE_URL=$VITE_SITE_URL
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
