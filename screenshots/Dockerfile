# Stage 1: Build agentsview binary
FROM golang:1.25-bookworm AS builder

RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

WORKDIR /src
COPY agentsview/ .

# Build frontend
RUN cd frontend && npm ci && npm run build
RUN cp -r frontend/dist internal/web/dist

# Build Go binary with FTS5 support
RUN CGO_ENABLED=1 go build -tags fts5 \
    -ldflags="-X main.version=docs -X main.commit=docs" \
    -o /bin/agentsview ./cmd/agentsview

# Stage 2: Extract test database (open-source projects only)
FROM debian:bookworm-slim AS db

RUN apt-get update && apt-get install -y sqlite3

WORKDIR /data
COPY source-sessions.db /data/source.db
COPY screenshots/extract-db.sh /data/extract-db.sh
RUN bash /data/extract-db.sh

# Stage 3: Run Playwright screenshots
FROM node:22-bookworm

WORKDIR /work

# Install Playwright dependencies
COPY screenshots/package.json .
RUN npm ci
RUN npx playwright install --with-deps chromium

# Copy agentsview binary and test database
COPY --from=builder /bin/agentsview /usr/local/bin/agentsview
COPY --from=db /data/test-sessions.db /data/sessions.db

# Copy test files
COPY screenshots/playwright.config.ts .
COPY screenshots/tests/ ./tests/
COPY screenshots/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
