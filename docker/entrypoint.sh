#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# PulseBoard Docker Entrypoint
# ---------------------------------------------------------------------------

echo "============================================="
echo " PulseBoard - Starting Environment"
echo "============================================="

# ---- Ensure storage and cache directories exist and are writable -----------
echo "[entrypoint] Setting directory permissions..."

mkdir -p /var/www/html/storage/app/public
mkdir -p /var/www/html/storage/framework/cache/data
mkdir -p /var/www/html/storage/framework/sessions
mkdir -p /var/www/html/storage/framework/testing
mkdir -p /var/www/html/storage/framework/views
mkdir -p /var/www/html/storage/logs
mkdir -p /var/www/html/bootstrap/cache

chown -R www-data:www-data /var/www/html/storage
chown -R www-data:www-data /var/www/html/bootstrap/cache
chmod -R 775 /var/www/html/storage
chmod -R 775 /var/www/html/bootstrap/cache

# ---- Composer dependencies -------------------------------------------------
if [ ! -d "/var/www/html/vendor" ] || [ ! -f "/var/www/html/vendor/autoload.php" ]; then
    echo "[entrypoint] Installing Composer dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
else
    echo "[entrypoint] Composer dependencies already installed."
fi

# ---- Node.js dependencies and frontend build --------------------------------
if [ ! -d "/var/www/html/node_modules" ]; then
    echo "[entrypoint] Installing npm dependencies..."
    npm ci --no-audit --no-fund
    echo "[entrypoint] Building frontend assets..."
    npm run build
else
    echo "[entrypoint] Node modules already installed."
fi

# ---- Generate application key if missing ------------------------------------
if [ -f "/var/www/html/.env" ] && ! grep -q "^APP_KEY=base64:" /var/www/html/.env 2>/dev/null; then
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

# ---- Cache configuration ----------------------------------------------------
echo "[entrypoint] Caching configuration..."
php artisan config:cache

# ---- Create storage symlink if missing ---------------------------------------
if [ ! -L "/var/www/html/public/storage" ]; then
    echo "[entrypoint] Creating storage symlink..."
    php artisan storage:link
fi

echo "============================================="
echo " PulseBoard - Environment Ready"
echo "============================================="

# ---- Start supervisord (PHP-FPM + Nginx) ------------------------------------
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
