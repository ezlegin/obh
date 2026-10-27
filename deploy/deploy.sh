#!/bin/sh
# Deploys an image GitHub built. Run on the server:
#   /opt/obh/deploy.sh                       # latest build, both apps
#   /opt/obh/deploy.sh <full-sha> [target]   # target: web | docs | both
# A rollback is a deploy of an older sha (images are never deleted by the
# build workflow, so any earlier commit stays pullable).
#
# Pulls the image, applies the Prisma schema with it (the project uses
# `prisma db push`, not migrations), and only when that succeeds restarts the
# target apps. A failed schema push stops here and leaves everything running
# as it was.
set -eu
cd /opt/obh
image=ghcr.io/ezlegin/obh
tag="${1:-latest}"
target="${2:-both}"
case "$target" in
  web) apps="web" ;;
  docs) apps="docs" ;;
  both) apps="web docs" ;;
  *) echo "target must be web, docs or both" >&2; exit 2 ;;
esac
# Images are tagged with the full commit sha (or latest).
if [ "$tag" != latest ] && ! printf '%s' "$tag" | grep -Eqx '[0-9a-f]{40}'; then
  echo "expected a full 40-character commit sha or \"latest\"" >&2
  exit 2
fi

docker pull -q "$image:$tag" >/dev/null
sha=$(docker image inspect "$image:$tag" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^APP_VERSION=//p')
# Images built before APP_VERSION existed are only addressable by their sha.
if [ -z "$sha" ] || [ "$sha" = dev ]; then
  [ "$tag" != latest ] || { echo "latest image has no APP_VERSION" >&2; exit 1; }
  sha="$tag"
fi
[ "$sha" = "$tag" ] || docker pull -q "$image:$sha" >/dev/null

get() { sed -n "s/^$1=//p" .env | tail -n 1; }
set_var() {
  sed -i "/^$1=/d" .env
  echo "$1=$2" >> .env
}

echo "applying the database schema for $sha"
# The tagged image is used only for this one-off container; the running web
# container keeps serving the previous build until the push succeeds.
if ! WEB_TAG="$sha" docker compose run --rm -T web \
  pnpm --silent --filter web db:push; then
  echo "schema push failed; nothing was restarted" >&2
  exit 1
fi

# Pin each target app, remembering the commit it replaces, before compose
# reads .env.
for app in $apps; do
  var=$(echo "${app}_TAG" | tr a-z A-Z)
  prev_var=$(echo "${app}_PREVIOUS_TAG" | tr a-z A-Z)
  previous=$(get "$var")
  set_var "$var" "$sha"
  if [ -n "$previous" ] && [ "$previous" != "$sha" ]; then
    set_var "$prev_var" "$previous"
  fi
done

# Compose recreates only the containers whose image changed.
# shellcheck disable=SC2086
docker compose up -d $apps
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $sha $target" >> deploys.log
docker compose ps

# Keep every image an app runs or can roll back to; remove other OBH images
# only — other apps' images are never touched.
keep=$(sed -n 's/^\(WEB\|DOCS\)_\(PREVIOUS_\)\{0,1\}TAG=//p' .env \
  | xargs -I{} docker image inspect -f '{{.Id}}' "$image:{}" 2>/dev/null | sort -u)
docker images --no-trunc -q "$image" | sort -u | while read -r id; do
  echo "$keep" | grep -qx "$id" || docker rmi -f "$id" >/dev/null 2>&1 || true
done
