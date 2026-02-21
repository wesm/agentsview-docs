#!/usr/bin/env bash
set -euo pipefail

# Extract only open-source project sessions from the source
# database. Runs inside the Docker build.

SOURCE="/data/source.db"
OUTPUT="/data/test-sessions.db"

PROJECTS="'msgvault','roborev','msgvault_docs','roborev_docs','agent_session_viewer','moneyflow'"

echo "Extracting open-source projects from source database..."

# Copy the full database to preserve exact schema
cp "$SOURCE" "$OUTPUT"

# Delete sessions (and related data) for non-matching projects
sqlite3 "$OUTPUT" <<SQL
DELETE FROM tool_calls WHERE session_id IN (
  SELECT id FROM sessions WHERE project NOT IN ($PROJECTS)
);
DELETE FROM messages WHERE session_id IN (
  SELECT id FROM sessions WHERE project NOT IN ($PROJECTS)
);
DELETE FROM sessions WHERE project NOT IN ($PROJECTS);

-- Rebuild FTS index
INSERT INTO messages_fts(messages_fts) VALUES('rebuild');

-- Update stats
INSERT OR REPLACE INTO stats (key, value) VALUES
  ('session_count', (SELECT COUNT(*) FROM sessions)),
  ('message_count', (SELECT COUNT(*) FROM messages));

VACUUM;
SQL

SESSIONS=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM sessions;")
MESSAGES=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM messages;")
SIZE=$(du -h "$OUTPUT" | cut -f1)

echo "Extracted: $SESSIONS sessions, $MESSAGES messages ($SIZE)"
sqlite3 "$OUTPUT" \
  "SELECT '  ' || project || ': ' || COUNT(*) || ' sessions' FROM sessions GROUP BY project ORDER BY COUNT(*) DESC;"
