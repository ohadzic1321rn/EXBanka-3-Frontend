#!/bin/sh
# Regenerate /config.js from env vars before nginx starts.
# Lets the same built bundle target dev (no env vars set → defaults) and the
# college K8s cluster (API_ORIGIN / USE_SLUGS set in the Pod spec).
set -e

API_ORIGIN="${API_ORIGIN:-}"
USE_SLUGS="${USE_SLUGS:-false}"

case "${USE_SLUGS}" in
  true|TRUE|1|yes) USE_SLUGS_JS=true ;;
  *) USE_SLUGS_JS=false ;;
esac

cat > /usr/share/nginx/html/config.js <<EOF
window.__APP_CONFIG__ = {
  apiOrigin: "${API_ORIGIN}",
  useSlugs: ${USE_SLUGS_JS}
};
EOF

exec nginx -g 'daemon off;'
