#!/usr/bin/env bash
set -Eeuo pipefail

# Invoked by a systemd timer. It restores only failed processes and applies a
# cooldown, avoiding an uncontrolled PM2 restart loop for a broken release.

readonly APP_USER="kilimanjaro"
readonly STATE_DIR="/run/kilimanjaro-health"
readonly COOLDOWN_SECONDS=300
readonly STARTUP_GRACE_SECONDS=120
readonly PM2=(runuser -u "$APP_USER" -- env HOME="/home/$APP_USER" PATH="/usr/local/bin:/usr/bin:/bin" pm2)

mkdir -p "$STATE_DIR"

cooldown_allows() {
  local name="$1" stamp="$STATE_DIR/$1"
  local now last=0
  now="$(date +%s)"
  [[ -f "$stamp" ]] && last="$(cat "$stamp")"
  if (( now - last < COOLDOWN_SECONDS )); then
    logger -t kilimanjaro-health "Skipping $name restart during cooldown"
    return 1
  fi
  printf '%s' "$now" >"$stamp"
}

restart_app() {
  local app="$1"
  if cooldown_allows "$app"; then
    logger -t kilimanjaro-health "Restarting $app after a failed health check"
    "${PM2[@]}" restart "$app" --update-env
  fi
}

if ! systemctl is-active --quiet pm2-kilimanjaro.service; then
  logger -t kilimanjaro-health "PM2 systemd unit is inactive; restarting it"
  systemctl restart pm2-kilimanjaro.service
  exit 0
fi

processes="$("${PM2[@]}" jlist)"
for app in ks-api-gateway ks-auth-service ks-student-service ks-academic-service ks-finance-service ks-notification-service ks-analytics-service ks-elearning-service; do
  state="$(node -e '
    const apps = JSON.parse(process.argv[1]);
    const app = apps.find((item) => item.name === process.argv[2]);
    const env = app?.pm2_env ?? app ?? {};
    const status = env.status ?? "missing";
    const startedAt = Number(env.pm_uptime ?? 0);
    const ageSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : Number.POSITIVE_INFINITY;
    process.stdout.write(status === "online" || (status === "launching" && ageSeconds < Number(process.argv[3])) ? "healthy" : "failed");
  ' "$processes" "$app" "$STARTUP_GRACE_SECONDS")"
  [[ "$state" == "healthy" ]] || restart_app "$app"
done

if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3000/health >/dev/null; then
  restart_app ks-api-gateway
fi
