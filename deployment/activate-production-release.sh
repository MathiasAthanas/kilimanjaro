#!/usr/bin/env bash
set -Eeuo pipefail

# Build and validate a staged release before atomically pointing production at it.
# Database migrations are deliberately excluded and must be run as a separate,
# reviewed deployment step.

readonly APP_ROOT="/opt/kilimanjaro"
readonly RELEASES_DIR="$APP_ROOT/releases"
readonly CURRENT_LINK="$APP_ROOT/app"
readonly CONFIG_DIR="/etc/kilimanjaro/services"
readonly APP_USER="kilimanjaro"
readonly SERVICES=(
  api-gateway
  auth-service
  student-service
  academic-service
  finance-service
  notification-service
  analytics-service
  elearning-service
)

usage() {
  echo "Usage: $0 /opt/kilimanjaro/releases/<release-name>" >&2
  exit 64
}

[[ $# -eq 1 ]] || usage
release_dir="$(readlink -f "$1")"
[[ "$release_dir" == "$RELEASES_DIR"/* && -d "$release_dir/backend" ]] || {
  echo "Release must be a directory below $RELEASES_DIR containing backend/." >&2
  exit 65
}

backend_dir="$release_dir/backend"
previous_release="$(readlink -f "$CURRENT_LINK")"
[[ -d "$CONFIG_DIR" ]] || {
  echo "Missing persistent service configuration at $CONFIG_DIR." >&2
  exit 66
}

for service in "${SERVICES[@]}"; do
  source_env="$CONFIG_DIR/$service.env"
  target_env="$backend_dir/services/$service/.env"
  [[ -f "$source_env" ]] || {
    echo "Missing configuration for $service." >&2
    exit 67
  }
  install -o "$APP_USER" -g "$APP_USER" -m 600 "$source_env" "$target_env"
done

run_as_app_user() {
  runuser -u "$APP_USER" -- env HOME="/home/$APP_USER" PATH="$PATH" "$@"
}

run_as_app_user bash -lc "cd '$backend_dir' && npm ci"
for service in "${SERVICES[@]}"; do
  run_as_app_user bash -lc "cd '$backend_dir' && npm run build --workspace=services/$service"
done

for service in "${SERVICES[@]}"; do
  case "$service" in
    student-service|notification-service)
      entry="$backend_dir/services/$service/dist/main.js"
      ;;
    *)
      entry="$backend_dir/services/$service/dist/src/main.js"
      ;;
  esac
  [[ -s "$entry" ]] || {
    echo "Missing compiled entry point: $entry" >&2
    exit 68
  }
  [[ -f "$backend_dir/services/$service/dist/generated/prisma/index.js" ]] || {
    echo "Missing generated Prisma client for $service." >&2
    exit 69
  }
done

rollback() {
  echo "Health verification failed; restoring $previous_release." >&2
  ln -sfn "$previous_release" "$APP_ROOT/app.next"
  mv -Tf "$APP_ROOT/app.next" "$CURRENT_LINK"
  run_as_app_user pm2 startOrReload "$CURRENT_LINK/backend/ecosystem.config.js" --update-env
}

ln -sfn "$release_dir" "$APP_ROOT/app.next"
mv -Tf "$APP_ROOT/app.next" "$CURRENT_LINK"
trap rollback ERR

run_as_app_user pm2 startOrReload "$CURRENT_LINK/backend/ecosystem.config.js" --update-env
sleep 12
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/health >/dev/null
run_as_app_user pm2 save
trap - ERR

echo "Activated and verified: $release_dir"
