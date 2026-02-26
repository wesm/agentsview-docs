#!/usr/bin/env bash
set -euo pipefail

# Extract only open-source project sessions from the source
# database. Runs inside the Docker build.

SOURCE="/data/source.db"
OUTPUT="/data/test-sessions.db"

PROJECTS="'roborev','roborev_docs','agentsview'"

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

-- Seed insights for screenshot capture
INSERT INTO insights (type, date_from, date_to, project, agent, model, content, created_at) VALUES
('daily_activity', '2026-02-20', '2026-02-20', 'roborev', 'claude', 'claude-opus-4-1',
'## Summary

3 sessions across roborev today, totaling 47 messages and 28 tool calls.

### Code Review Engine Improvements

The main focus was on the code review engine. Two sessions worked on improving how review findings are grouped and deduplicated before being presented to the user.

- **Finding deduplication** — added content-hash-based dedup to prevent the same issue from appearing multiple times when files are re-reviewed. Implemented in `internal/review/dedup.go` with a sliding window approach.
- **Severity classification** — refined the severity model to distinguish between style issues, potential bugs, and architectural concerns. Updated the prompt templates in `internal/review/prompts/`.

### Test Coverage

One session focused entirely on adding test coverage for the new dedup logic. Added table-driven tests covering edge cases: overlapping findings, findings across file boundaries, and hash collisions.

### Tool Usage

| Category | Count |
|----------|-------|
| Read     | 12    |
| Edit     | 8     |
| Bash     | 5     |
| Search   | 3     |',
'2026-02-20T18:30:00.000Z'),

('agent_analysis', '2026-02-14', '2026-02-20', NULL, 'claude', 'claude-opus-4-1',
'## Weekly Analysis — Feb 14–20

### Overview

18 sessions across 3 projects over 7 days. Total: 312 messages, 187 tool calls.

| Project | Sessions | Messages | Tool Calls |
|---------|----------|----------|------------|
| roborev | 10 | 198 | 124 |
| agentsview | 5 | 72 | 41 |

### Patterns

**Session length** — median session was 14 messages. Longest session (38 messages) was a roborev refactoring session that touched 12 files. Shorter sessions (under 8 messages) were typically quick bug fixes or documentation updates.

**Tool distribution** — Read and Edit dominate at 68% of all tool calls. Bash usage is concentrated in roborev (test runs and linting). Search tool usage is low, suggesting good familiarity with the codebases.

**Time of day** — most sessions start between 9–11am and 2–4pm, with a gap around lunch. No late-night sessions this week.

### Effectiveness

- Sessions that started with a clear, specific prompt ("fix the failing test in dedup_test.go") completed faster (avg 8 messages) than open-ended ones ("improve the review engine") which averaged 22 messages.
- Tool call errors were rare (3 out of 187), all from file paths that had been renamed mid-session.

### Recommendations

1. **Break up long sessions** — the 38-message refactoring session could have been 2–3 focused sessions with clearer scope.
2. **Use search more** — several sessions spent multiple Read calls navigating to the right file. A Grep or Glob call upfront would save turns.
3. **Pin test commands** — repeated manual test invocations could be replaced with a single Bash alias or Makefile target.',
'2026-02-21T10:15:00.000Z');

VACUUM;
SQL

SESSIONS=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM sessions;")
MESSAGES=$(sqlite3 "$OUTPUT" "SELECT COUNT(*) FROM messages;")
SIZE=$(du -h "$OUTPUT" | cut -f1)

echo "Extracted: $SESSIONS sessions, $MESSAGES messages ($SIZE)"
sqlite3 "$OUTPUT" \
  "SELECT '  ' || project || ': ' || COUNT(*) || ' sessions' FROM sessions GROUP BY project ORDER BY COUNT(*) DESC;"
