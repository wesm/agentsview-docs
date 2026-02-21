#!/usr/bin/env bash
set -euo pipefail

# Capture screenshots for documentation using Playwright.
#
# Prerequisites:
#   - agentsview built at ~/code/agentsview
#   - Test database at fixtures/sessions.db
#   - npm dependencies installed
#
# Usage:
#   ./scripts/capture-screenshots.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTSVIEW_DIR="${AGENTSVIEW_DIR:-$HOME/code/agentsview}"
DB_PATH="$ROOT/fixtures/sessions.db"
PORT=8090
SCREENSHOT_DIR="$ROOT/public/screenshots"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: test database not found at $DB_PATH"
  echo ""
  echo "Create it first:"
  echo "  ./scripts/create-test-db.sh ~/.agentsview/sessions.db \\"
  echo "    fixtures/sessions.db roborev agentsview msgvault"
  exit 1
fi

# Build agentsview if needed
BINARY="$AGENTSVIEW_DIR/agentsview"
if [ ! -f "$BINARY" ]; then
  echo "Building agentsview..."
  cd "$AGENTSVIEW_DIR"
  make build
  cd "$ROOT"
  BINARY="$AGENTSVIEW_DIR/agentsview"
fi

if [ ! -f "$BINARY" ]; then
  echo "Error: agentsview binary not found."
  echo "Build it: cd $AGENTSVIEW_DIR && make build"
  exit 1
fi

# Create screenshot output directory
mkdir -p "$SCREENSHOT_DIR"

# Create temp directory for server data
TMPDIR=$(mktemp -d)
trap 'kill $SERVER_PID 2>/dev/null || true; rm -rf "$TMPDIR"' EXIT

# Copy test database to temp (so server doesn't modify the fixture)
cp "$DB_PATH" "$TMPDIR/sessions.db"

# Empty directories to prevent live sync
EMPTY_DIR="$TMPDIR/empty"
mkdir -p "$EMPTY_DIR"

echo "Starting agentsview on port $PORT..."
AGENT_VIEWER_DATA_DIR="$TMPDIR" \
CLAUDE_PROJECTS_DIR="$EMPTY_DIR" \
CODEX_SESSIONS_DIR="$EMPTY_DIR" \
GEMINI_DIR="$EMPTY_DIR" \
"$BINARY" -port "$PORT" -no-browser &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/api/v1/stats" > /dev/null 2>&1; then
    echo "Server ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Error: server failed to start within 30 seconds"
    exit 1
  fi
  sleep 1
done

# Run Playwright tests
echo ""
echo "Capturing screenshots..."
npx playwright test --project=screenshots

echo ""
echo "Screenshots saved to $SCREENSHOT_DIR/"
ls -la "$SCREENSHOT_DIR/"

echo ""
echo "Done. Kill the server and clean up."
