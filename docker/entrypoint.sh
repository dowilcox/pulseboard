#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# PulseBoard Docker Entrypoint
# Handles both development (APP_ENV=local) and production modes.
# ---------------------------------------------------------------------------

echo "============================================="
echo " PulseBoard - Starting Environment"
echo " Mode: ${APP_ENV:-production}"
echo "============================================="

# ---- Default Octane workers (can be overridden via OCTANE_WORKERS env) -----
export OCTANE_WORKERS="${OCTANE_WORKERS:-4}"

# ---- Ensure storage and cache directories exist and are writable -----------
echo "[entrypoint] Setting directory permissions..."

mkdir -p /var/www/html/storage/app/public
mkdir -p /var/www/html/storage/framework/cache/data
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/testing
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/bootstrap/cache

chmod -R 775 /var/www/html/storage
chmod -R 775 /var/www/html/bootstrap/cache

# ---- Development-only: install dependencies and build frontend -------------
if [ "${APP_ENV}" = "local" ] || [ "${APP_ENV}" = "development" ]; then
    if [ ! -d "/var/www/html/vendor" ] || [ ! -f "/var/www/html/vendor/autoload.php" ]; then
        echo "[entrypoint] Installing Composer dependencies..."
        composer install --no-interaction --prefer-dist --optimize-autoloader
    else
        echo "[entrypoint] Composer dependencies already installed."
    fi

    if [ ! -d "/var/www/html/node_modules" ]; then
        echo "[entrypoint] Installing npm dependencies..."
        npm ci --no-audit --no-fund
        echo "[entrypoint] Building frontend assets..."
        npm run build
    else
        echo "[entrypoint] Node modules already installed."
    fi
fi

# ---- Ensure .env file exists -------------------------------------------------
# Laravel requires a .env file for key generation and config caching.
# If no .env is mounted, create one from the current environment variables.
if [ ! -f "/var/www/html/.env" ]; then
    echo "[entrypoint] No .env file found, creating from environment..."
    env | grep -E '^(APP_|DB_|REDIS_|MAIL_|QUEUE_|CACHE_|SESSION_|BROADCAST_|LOG_|REVERB_|VITE_|OCTANE_|FILESYSTEM_|BCRYPT_|TRUSTED_)' \
        | sort > /var/www/html/.env
fi

# ---- Generate application key if missing ------------------------------------
if ! grep -q "^APP_KEY=base64:" /var/www/html/.env 2>/dev/null; then
    echo "[entrypoint] Generating application key..."
    php artisan key:generate --force
fi

# ---- Wait for database and run migrations -----------------------------------
wait_for_db() {
    local max_attempts=30
    local attempt=1

    echo "[entrypoint] Waiting for database connection..."
    while [ $attempt -le $max_attempts ]; do
        if php artisan db:monitor --databases=mysql > /dev/null 2>&1 || \
           php -r "new PDO('mysql:host=${DB_HOST:-mysql};port=${DB_PORT:-3306};dbname=${DB_DATABASE:-pulseboard}', '${DB_USERNAME:-pulseboard}', '${DB_PASSWORD:-secret}');" 2>/dev/null; then
            echo "[entrypoint] Database is available."
            return 0
        fi
        echo "[entrypoint] Database not ready (attempt $attempt/$max_attempts). Retrying in 2s..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo "[entrypoint] WARNING: Could not connect to database after $max_attempts attempts."
    return 1
}

if wait_for_db; then
    echo "[entrypoint] Running database migrations..."
    php artisan migrate --force
else
    echo "[entrypoint] Skipping migrations (database unavailable)."
fi

# ---- Publish FrankenPHP worker if missing ------------------------------------
if [ ! -f "/var/www/html/public/frankenphp-worker.php" ]; then
    echo "[entrypoint] Publishing FrankenPHP worker..."
    php artisan octane:install --server=frankenphp --no-interaction
fi

# ---- Ensure FrankenPHP binary is in PATH ------------------------------------
if [ ! -f "/usr/local/bin/frankenphp" ] && [ -f "/var/www/html/frankenphp" ]; then
    ln -sf /var/www/html/frankenphp /usr/local/bin/frankenphp
fi

# ---- Verify APP_KEY is set before caching ------------------------------------
if ! grep -q "^APP_KEY=base64:" /var/www/html/.env 2>/dev/null; then
    echo "[entrypoint] ERROR: APP_KEY is still not set after key generation. Aborting."
    exit 1
fi

# ---- Optimize for production ------------------------------------------------
if [ "${APP_ENV}" != "local" ] && [ "${APP_ENV}" != "development" ]; then
    echo "[entrypoint] Caching configuration for production..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan event:cache
else
    echo "[entrypoint] Caching configuration..."
    php artisan config:cache
fi

# ---- Create storage symlink if missing ---------------------------------------
if [ ! -L "/var/www/html/public/storage" ]; then
    echo "[entrypoint] Creating storage symlink..."
    php artisan storage:link
fi

echo "============================================="
echo " PulseBoard - Environment Ready (FrankenPHP)"
echo " Workers: ${OCTANE_WORKERS}"
echo "============================================="

# ---- Start supervisord (Octane + Reverb + Queue + Scheduler) -----------------
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
