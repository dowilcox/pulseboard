#!/bin/bash
set -euo pipefail

cd /var/www/html

export APP_ENV="${APP_ENV:-testing}"
export APP_KEY="${APP_KEY:-base64:dGVzdGluZ2tleWZvcmNpcGlwZWxpbmVydW4xMjM0NTY=}"
export APP_CONFIG_CACHE="${APP_CONFIG_CACHE:-/tmp/pulseboard-config.php}"
export APP_PACKAGES_CACHE="${APP_PACKAGES_CACHE:-/tmp/pulseboard-packages.php}"
export APP_SERVICES_CACHE="${APP_SERVICES_CACHE:-/tmp/pulseboard-services.php}"
export DB_CONNECTION="${DB_CONNECTION:-sqlite}"
export DB_DATABASE="${DB_DATABASE:-:memory:}"
export CACHE_STORE="${CACHE_STORE:-array}"
export SESSION_DRIVER="${SESSION_DRIVER:-array}"
export QUEUE_CONNECTION="${QUEUE_CONNECTION:-sync}"

mkdir -p \
    bootstrap/cache \
    storage/logs \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views

chmod -R 775 storage bootstrap/cache || true

if [ ! -f vendor/autoload.php ]; then
    echo "[test-entrypoint] Installing Composer dependencies..."
    composer install --no-interaction --prefer-dist
fi

case "${1:-}" in
    npm|npx|node)
        if [ ! -d node_modules ]; then
            echo "[test-entrypoint] Installing npm dependencies..."
            npm ci --no-audit --no-fund
        fi
        ;;
esac

if [ "$#" -eq 0 ]; then
    set -- php artisan test
elif [[ "$1" == -* ]] || [[ "$1" == tests/* ]] || [[ "$1" == *.php ]]; then
    set -- php artisan test "$@"
fi

if [ "${1:-}" = "php" ] && [ "${2:-}" = "artisan" ]; then
    php artisan optimize:clear >/dev/null
fi

exec "$@"
