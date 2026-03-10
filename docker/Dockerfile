# ---------------------------------------------------------------------------
# PulseBoard Docker Image
# Multi-stage build: composer deps → frontend build → production runtime
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Stage 1: Composer dependencies
# ---------------------------------------------------------------------------
FROM docker.io/library/composer:2 AS composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts \
    --no-progress

# ---------------------------------------------------------------------------
# Stage 2: Frontend build
# ---------------------------------------------------------------------------
FROM docker.io/library/node:20-alpine AS frontend

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY resources ./resources
COPY tsconfig.json vite.config.ts ./
COPY public ./public

# Composer autoload + Laravel framework needed for Ziggy route generation
COPY --from=composer /app/vendor ./vendor
COPY artisan ./
COPY bootstrap ./bootstrap
COPY config ./config
COPY routes ./routes
COPY app ./app
COPY database ./database

# Minimal .env for Vite build (only APP_NAME needed; Reverb config is runtime via Inertia)
ARG VITE_APP_NAME=PulseBoard

RUN echo "APP_NAME=${VITE_APP_NAME}" > .env \
    && echo "VITE_APP_NAME=${VITE_APP_NAME}" >> .env

RUN npx tsc --noEmit && npx vite build

# ---------------------------------------------------------------------------
# Stage 3: Production runtime
# ---------------------------------------------------------------------------
FROM docker.io/dunglas/frankenphp:1-php8.4 AS production

LABEL maintainer="PulseBoard" \
      org.opencontainers.image.title="PulseBoard" \
      org.opencontainers.image.description="Self-hosted Kanban project management with GitLab integration" \
      org.opencontainers.image.source="https://github.com/dowilcox/pulseboard" \
      org.opencontainers.image.licenses="GPL-3.0"

# ---- System dependencies ---------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libzip-dev \
        supervisor \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# ---- PHP extensions --------------------------------------------------------
RUN docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        pcntl \
        pdo_mysql \
        zip

# Install Redis extension via PECL
RUN pecl install redis \
    && docker-php-ext-enable redis

# ---- Configuration files ---------------------------------------------------
COPY docker/php.ini         /usr/local/etc/php/conf.d/99-custom.ini
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh   /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# ---- Application code ------------------------------------------------------
WORKDIR /var/www/html

# Copy application source
COPY composer.json composer.lock ./
COPY artisan ./
COPY bootstrap ./bootstrap
COPY config ./config
COPY database ./database
COPY public ./public
COPY resources/views ./resources/views
COPY routes ./routes
COPY app ./app

# Copy built assets from previous stages
COPY --from=composer /app/vendor ./vendor
COPY --from=frontend /app/public/build ./public/build

# ---- Storage directories ---------------------------------------------------
RUN mkdir -p \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/testing \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# ---- Health check -----------------------------------------------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/up || exit 1

EXPOSE 8000 8080

ENTRYPOINT ["entrypoint.sh"]

# ---------------------------------------------------------------------------
# Stage 4: Development (optional target for local dev)
# ---------------------------------------------------------------------------
FROM docker.io/dunglas/frankenphp:1-php8.4 AS development

LABEL maintainer="PulseBoard Development"

# ---- System dependencies (includes git + Node.js for dev) ------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        git \
        gnupg2 \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libsqlite3-dev \
        libzip-dev \
        supervisor \
        unzip \
        zip \
    && rm -rf /var/lib/apt/lists/*

# ---- PHP extensions --------------------------------------------------------
RUN docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        pcntl \
        pdo_mysql \
        pdo_sqlite \
        zip

RUN pecl install redis \
    && docker-php-ext-enable redis

# ---- Composer --------------------------------------------------------------
COPY --from=docker.io/library/composer:2 /usr/bin/composer /usr/bin/composer

# ---- Node.js 20 LTS -------------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Configuration files ---------------------------------------------------
COPY docker/php.dev.ini     /usr/local/etc/php/conf.d/99-custom.ini
COPY docker/supervisord.dev.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh   /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

WORKDIR /var/www/html

RUN mkdir -p storage/logs bootstrap/cache

EXPOSE 8000 8080

ENTRYPOINT ["entrypoint.sh"]
