#!/bin/bash
set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/dist"

if [ ! -f "$DIST_DIR/main.js" ]; then
  echo "Error: cc-sessions is not built. Run 'npm run build' first." >&2
  exit 1
fi

RESUME_FILE=$(mktemp)
trap 'rm -f "$RESUME_FILE"' EXIT

node "$DIST_DIR/main.js" --resume-file "$RESUME_FILE" "$@"

if [ -s "$RESUME_FILE" ]; then
  UUID=$(cat "$RESUME_FILE")
  exec claude --resume "$UUID"
fi
