# ---------------------------------------------------------------------------
# PulseBoard Development Container
# PHP 8.3-FPM + Nginx + Node.js 20 LTS
# ---------------------------------------------------------------------------

FROM docker.io/library/php:8.4-fpm

LABEL maintainer="PulseBoard Development"

# ---- System dependencies ---------------------------------------------------
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
        nginx \
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

# Install Redis extension via PECL
RUN pecl install redis \
    && docker-php-ext-enable redis

# ---- Composer --------------------------------------------------------------
COPY --from=docker.io/library/composer:2 /usr/bin/composer /usr/bin/composer

# ---- Node.js 20 LTS -------------------------------------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# ---- Configuration files ---------------------------------------------------
COPY docker/nginx.conf   /etc/nginx/sites-available/default
COPY docker/php.ini      /usr/local/etc/php/conf.d/99-custom.ini
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh    /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# ---- Working directory -----------------------------------------------------
WORKDIR /var/www/html

# ---- Create application user -----------------------------------------------
RUN groupadd -g 1000 appuser \
    && useradd -u 1000 -g appuser -m appuser

# ---- Ensure writable directories exist -------------------------------------
RUN mkdir -p /var/www/html/storage/logs \
    && mkdir -p /var/www/html/bootstrap/cache \
    && chown -R appuser:appuser /var/www/html

# ---- Remove default Nginx site & pid path fix ------------------------------
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default \
    && mkdir -p /run/nginx

EXPOSE 80 8080

ENTRYPOINT ["entrypoint.sh"]
