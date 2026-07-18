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
echo "Starting SpriteWrite on port ${PORT}..."

npm run dev -- --host 127.0.0.1 --port "$PORT" --strictPort
