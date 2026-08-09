#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

PORT="${1:-${SPRITEWRITE_PORT:-5173}}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || ((PORT < 1 || PORT > 65535)); then
  echo "Invalid port: $PORT"
  exit 1
fi

export SPRITEWRITE_PORT="$PORT"
if [[ -z "${SPRITEWRITE_API_PORT:-}" ]]; then
  SPRITEWRITE_API_PORT=$((PORT + 1))
fi
if [[ "$SPRITEWRITE_API_PORT" -eq "$PORT" ]]; then
  if [[ "$PORT" -eq 65535 ]]; then
    SPRITEWRITE_API_PORT=$((PORT - 1))
  else
    SPRITEWRITE_API_PORT=$((PORT + 1))
  fi
fi
export SPRITEWRITE_API_PORT

echo "Starting SpriteWrite on port ${PORT}..."
echo "API on port ${SPRITEWRITE_API_PORT}..."

echo "Starting automation API on http://127.0.0.1:${SPRITEWRITE_API_PORT}"
npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort
