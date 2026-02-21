#!/usr/bin/env bash
set -euo pipefail

PORT=8090
DATA_DIR=$(mktemp -d)
EMPTY_DIR="$DATA_DIR/empty"
mkdir -p "$EMPTY_DIR" /output

# Copy test database so the server doesn't modify the original
cp /data/sessions.db "$DATA_DIR/sessions.db"

echo "Starting agentsview on port $PORT..."
AGENT_VIEWER_DATA_DIR="$DATA_DIR" \
CLAUDE_PROJECTS_DIR="$EMPTY_DIR" \
CODEX_SESSIONS_DIR="$EMPTY_DIR" \
GEMINI_DIR="$EMPTY_DIR" \
agentsview -port "$PORT" -no-browser &
SERVER_PID=$!

# Wait for server to be ready
echo "Waiting for server..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/api/v1/stats" > /dev/null 2>&1; then
    echo "Server ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Error: server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

echo ""
echo "Capturing screenshots..."
SCREENSHOT_DIR=/output npx playwright test --reporter=list 2>&1
EXIT_CODE=$?

# Show results
echo ""
if [ -d /output ]; then
  COUNT=$(ls -1 /output/*.png 2>/dev/null | wc -l)
  echo "Captured $COUNT screenshots"
  ls -la /output/*.png 2>/dev/null || true
fi

kill $SERVER_PID 2>/dev/null || true
exit $EXIT_CODE
