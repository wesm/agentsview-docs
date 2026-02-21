#!/usr/bin/env bash
set -euo pipefail

# Extract sessions for specified projects from the real
# agentsview database into a standalone test database.
#
# Usage:
#   ./scripts/create-test-db.sh [source_db] [output_db] [projects...]
#
# Example:
#   ./scripts/create-test-db.sh ~/.agentsview/sessions.db \
#     fixtures/sessions.db roborev agentsview msgvault

SOURCE_DB="${1:?Usage: create-test-db.sh <source_db> <output_db> <project1> [project2] ...}"
OUTPUT_DB="${2:?Usage: create-test-db.sh <source_db> <output_db> <project1> [project2] ...}"
shift 2

if [ $# -eq 0 ]; then
  echo "Error: at least one project name required"
  echo ""
  echo "Available projects:"
  sqlite3 "$SOURCE_DB" \
    "SELECT project, COUNT(*) || ' sessions' FROM sessions GROUP BY project ORDER BY COUNT(*) DESC;"
  exit 1
fi

# Build SQL WHERE clause for project matching
PROJECT_CLAUSE=""
for proj in "$@"; do
  if [ -n "$PROJECT_CLAUSE" ]; then
    PROJECT_CLAUSE="$PROJECT_CLAUSE OR "
  fi
  PROJECT_CLAUSE="${PROJECT_CLAUSE}project = '${proj}'"
done

echo "Source:   $SOURCE_DB"
echo "Output:   $OUTPUT_DB"
echo "Projects: $*"
echo "Filter:   $PROJECT_CLAUSE"
echo ""

# Remove existing output
rm -f "$OUTPUT_DB"
mkdir -p "$(dirname "$OUTPUT_DB")"

# Create schema in output database
sqlite3 "$OUTPUT_DB" <<'SCHEMA'
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  machine TEXT NOT NULL DEFAULT 'local',
  agent TEXT NOT NULL DEFAULT 'claude',
  first_message TEXT,
  started_at TEXT,
  ended_at TEXT,
  message_count INTEGER DEFAULT 0,
  file_path TEXT,
  file_size INTEGER,
  file_mtime INTEGER,
  file_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  timestamp TEXT,
  has_thinking INTEGER DEFAULT 0,
  has_tool_use INTEGER DEFAULT 0,
  content_length INTEGER DEFAULT 0,
  UNIQUE(session_id, ordinal),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE stats (
  key TEXT PRIMARY KEY,
  value INTEGER DEFAULT 0
);

CREATE INDEX idx_sessions_ended_at ON sessions(ended_at DESC);
CREATE INDEX idx_sessions_project ON sessions(project);
CREATE INDEX idx_sessions_machine ON sessions(machine);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_sessions_message_count ON sessions(message_count);
CREATE INDEX idx_sessions_agent ON sessions(agent);
CREATE INDEX idx_messages_session_ordinal ON messages(session_id, ordinal);
CREATE INDEX idx_messages_session_role ON messages(session_id, role);
CREATE INDEX idx_tool_calls_session ON tool_calls(session_id);
CREATE INDEX idx_tool_calls_category ON tool_calls(category);

-- FTS5 full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content='messages',
  content_rowid='id',
  tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;

CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES('delete', old.id, old.content);
END;

CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES('delete', old.id, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
END;
SCHEMA

echo "Schema created."

# Copy matching data from source to output
sqlite3 "$SOURCE_DB" <<SQL
ATTACH DATABASE '$OUTPUT_DB' AS dest;

-- Copy sessions
INSERT INTO dest.sessions
SELECT * FROM sessions WHERE $PROJECT_CLAUSE;

-- Copy messages for those sessions
INSERT INTO dest.messages (session_id, ordinal, role, content, timestamp, has_thinking, has_tool_use, content_length)
SELECT m.session_id, m.ordinal, m.role, m.content, m.timestamp,
       m.has_thinking, m.has_tool_use, m.content_length
FROM messages m
JOIN sessions s ON m.session_id = s.id
WHERE $PROJECT_CLAUSE;

-- Copy tool calls for those sessions
INSERT INTO dest.tool_calls (message_id, session_id, tool_name, category)
SELECT t.message_id, t.session_id, t.tool_name, t.category
FROM tool_calls t
JOIN sessions s ON t.session_id = s.id
WHERE $PROJECT_CLAUSE;

DETACH dest;
SQL

echo "Data copied."

# Populate FTS index
sqlite3 "$OUTPUT_DB" <<'FTS'
INSERT INTO messages_fts(rowid, content)
SELECT id, content FROM messages;
FTS

# Update stats
sqlite3 "$OUTPUT_DB" <<'STATS'
INSERT OR REPLACE INTO stats (key, value)
VALUES
  ('session_count', (SELECT COUNT(*) FROM sessions)),
  ('message_count', (SELECT COUNT(*) FROM messages));
STATS

# Report
SESSIONS=$(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM sessions;")
MESSAGES=$(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM messages;")
TOOLS=$(sqlite3 "$OUTPUT_DB" "SELECT COUNT(*) FROM tool_calls;")
SIZE=$(du -h "$OUTPUT_DB" | cut -f1)

echo ""
echo "Done."
echo "  Sessions:   $SESSIONS"
echo "  Messages:   $MESSAGES"
echo "  Tool calls: $TOOLS"
echo "  Size:       $SIZE"
echo ""
echo "Projects included:"
sqlite3 "$OUTPUT_DB" \
  "SELECT '  ' || project || ': ' || COUNT(*) || ' sessions, ' || SUM(message_count) || ' messages' FROM sessions GROUP BY project ORDER BY COUNT(*) DESC;"
