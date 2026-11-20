#!/usr/bin/env bash
# Hikoya auto-deploy: pulls the rolling build from GitHub Releases and extracts
# it into the web root. Run by cron every couple of minutes. Place this file at:
# <webroot>/deploy/deploy-pull.sh
#
# Safety: extracts with overwrite-merge only (never deletes). public/uploads/*,
# .env.production.local and old .next chunks are left untouched.
#
# NOTE: this build logs a one-line heartbeat on every run (what SHA it sees) to
# diagnose a stuck deploy, and cache-busts the release fetch so a stale CDN copy
# of the tiny SHA file can't pin the server to an old build. The heartbeat can
# be trimmed back to silent-on-idle once deploys are confirmed healthy again.

set -uo pipefail

REPO="tavsiyaapp-startup/Hikoya-website"
TAG="deploy-latest"
BASE="https://github.com/${REPO}/releases/download/${TAG}"

# This script sits in <webroot>/deploy, so the web root is its parent folder.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBROOT="$(dirname "$SCRIPT_DIR")"
MARKER="${SCRIPT_DIR}/deployed_sha.txt"
PKG_HASH_FILE="${SCRIPT_DIR}/pkg_hash.txt"
LOCK="${SCRIPT_DIR}/deploy.lock"
WORK="${SCRIPT_DIR}/work"

ts()  { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $*"; }

# A unique query per request bypasses any edge-cached redirect, so a CDN node
# that still holds the previous release's SHA/zip can't keep us on an old build.
CB="$(date +%s)-$$"
SHA_URL="${BASE}/BUILD_SHA.txt?cb=${CB}"
ZIP_URL="${BASE}/hikoya-build.zip?cb=${CB}"
NOCACHE=(-H "Cache-Control: no-cache" -H "Pragma: no-cache")

# --- single instance (portable lock via mkdir; clears a stale lock >30 min) ---
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
  log "removing stale lock"; rmdir "$LOCK" 2>/dev/null || true
fi
if ! mkdir "$LOCK" 2>/dev/null; then
  log "heartbeat: another run active; skipping"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null || true; rm -rf "$WORK" 2>/dev/null || true' EXIT

# --- change gate (with a heartbeat so a stuck deploy is visible in the log) ---
REMOTE_SHA="$(curl -fsSL --max-time 30 "${NOCACHE[@]}" "$SHA_URL" | tr -d '[:space:]')"
RC=$?
LOCAL_SHA="$(tr -d '[:space:]' < "$MARKER" 2>/dev/null || true)"
log "heartbeat: sha_rc=${RC} remote=${REMOTE_SHA:-EMPTY} local=${LOCAL_SHA:-none}"

if [ -z "$REMOTE_SHA" ]; then
  log "no remote SHA (release unreachable from here); will retry next run"
  exit 0
fi
if [ "$REMOTE_SHA" = "$LOCAL_SHA" ]; then
  exit 0   # nothing new
fi

log "new build detected: ${REMOTE_SHA} (was: ${LOCAL_SHA:-none})"

# --- download ---
rm -rf "$WORK"; mkdir -p "$WORK"
ZIP="${WORK}/build.zip"
if ! curl -fsSL --max-time 600 "${NOCACHE[@]}" "$ZIP_URL" -o "$ZIP"; then
  log "ERROR: download failed; will retry next run"; exit 0
fi

# --- integrity check ---
if command -v unzip >/dev/null 2>&1; then
  if ! unzip -tqq "$ZIP" >/dev/null 2>&1; then
    log "ERROR: downloaded zip is corrupt; aborting (will retry next run)"; exit 0
  fi
fi

# --- extract (overwrite-merge; never deletes existing files) ---
log "extracting into ${WEBROOT} ..."
if command -v unzip >/dev/null 2>&1; then
  if ! unzip -oqq "$ZIP" -d "$WEBROOT"; then
    log "ERROR: extract failed"; exit 0
  fi
elif command -v python3 >/dev/null 2>&1; then
  if ! python3 - "$ZIP" "$WEBROOT" <<'PY'
import sys, zipfile
src, dest = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as z:
    z.extractall(dest)
PY
  then
    log "ERROR: python extract failed"; exit 0
  fi
else
  log "ERROR: neither 'unzip' nor 'python3' is available; cannot extract"; exit 0
fi

# --- warn (do not auto-install) if dependencies changed ---
if command -v sha1sum >/dev/null 2>&1 && [ -f "${WEBROOT}/package.json" ]; then
  NEWH="$(sha1sum "${WEBROOT}/package.json" | cut -d' ' -f1)"
  OLDH="$(cat "$PKG_HASH_FILE" 2>/dev/null || true)"
  if [ -n "$OLDH" ] && [ "$NEWH" != "$OLDH" ]; then
    log "NOTE: package.json changed — run 'npm install --omit=dev' in ${WEBROOT} before Restart if the site errors."
  fi
  echo "$NEWH" > "$PKG_HASH_FILE"
fi

# --- record success + best-effort graceful restart (harmless if unsupported) ---
echo "$REMOTE_SHA" > "$MARKER"
mkdir -p "${WEBROOT}/tmp" 2>/dev/null && touch "${WEBROOT}/tmp/restart.txt" 2>/dev/null || true
log "deploy complete for ${REMOTE_SHA}. Press Restart in ISPmanager to apply."
