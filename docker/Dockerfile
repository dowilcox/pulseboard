# ---------------------------------------------------------------------------
# PulseBoard Development Container
# FrankenPHP (Octane) + Node.js 20 LTS
# ---------------------------------------------------------------------------

FROM dunglas/frankenphp:latest

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
COPY docker/php.ini         /usr/local/etc/php/conf.d/99-custom.ini
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh   /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh

# ---- Working directory -----------------------------------------------------
WORKDIR /var/www/html

# ---- Ensure writable directories exist -------------------------------------
RUN mkdir -p /var/www/html/storage/logs \
    && mkdir -p /var/www/html/bootstrap/cache

EXPOSE 8000 8080

ENTRYPOINT ["entrypoint.sh"]
