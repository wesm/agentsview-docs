#!/usr/bin/env bash
set -euo pipefail

# Build and run the dockerized screenshot pipeline.
#
# Usage:
#   ./screenshots/run.sh
#
# Environment:
#   AGENTSVIEW_SRC   Path to agentsview source (default: ~/code/agentsview)
#   SOURCE_DB        Path to real sessions database (default: ~/.agentsview/sessions.db)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENTSVIEW_SRC="${AGENTSVIEW_SRC:-$HOME/code/agentsview}"
SOURCE_DB="${SOURCE_DB:-$HOME/.agentsview/sessions.db}"
OUTPUT_DIR="$ROOT/public/screenshots"
IMAGE_NAME="agentsview-screenshots"

# Verify prerequisites
if ! command -v docker &> /dev/null; then
  echo "Error: docker is required"
  exit 1
fi

if [ ! -d "$AGENTSVIEW_SRC" ]; then
  echo "Error: agentsview source not found at $AGENTSVIEW_SRC"
  echo "Set AGENTSVIEW_SRC to the correct path"
  exit 1
fi

if [ ! -f "$SOURCE_DB" ]; then
  echo "Error: sessions database not found at $SOURCE_DB"
  echo "Set SOURCE_DB to the correct path"
  exit 1
fi

echo "=== agentsview screenshot pipeline ==="
echo "Source code: $AGENTSVIEW_SRC"
echo "Source DB:   $SOURCE_DB"
echo "Output:      $OUTPUT_DIR"
echo ""

# Assemble Docker build context in temp directory
CONTEXT=$(mktemp -d)
trap 'rm -rf "$CONTEXT"' EXIT

echo "Assembling build context..."

# Copy agentsview source (exclude heavy/unnecessary dirs)
rsync -a \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.cache' \
  --exclude='/agentsview' \
  "$AGENTSVIEW_SRC/" "$CONTEXT/agentsview/"

# Copy source database
cp "$SOURCE_DB" "$CONTEXT/source-sessions.db"

# Copy screenshot pipeline files
cp -r "$ROOT/screenshots/" "$CONTEXT/screenshots/"
cp "$ROOT/screenshots/Dockerfile" "$CONTEXT/Dockerfile"

echo "Build context: $(du -sh "$CONTEXT" | cut -f1)"
echo ""

# Build Docker image
echo "Building Docker image (this may take a few minutes on first run)..."
docker build -t "$IMAGE_NAME" "$CONTEXT"

echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Run screenshots
echo "Running screenshot capture..."
docker run --rm \
  -v "$OUTPUT_DIR:/output" \
  "$IMAGE_NAME"

echo ""
echo "=== Done ==="
echo "Screenshots saved to $OUTPUT_DIR/"
ls -la "$OUTPUT_DIR/"*.png 2>/dev/null || echo "(no screenshots found)"
