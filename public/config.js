// Default runtime config — same-origin, no per-service URL slug.
// In dev and local docker-compose this file is served as-is.
// In the cluster, the frontend container entrypoint regenerates this file
// from env vars (API_ORIGIN, USE_SLUGS) before nginx starts, so the same
// built bundle can target any environment without rebuilding.
window.__APP_CONFIG__ = {
  apiOrigin: "",
  useSlugs: false
};
