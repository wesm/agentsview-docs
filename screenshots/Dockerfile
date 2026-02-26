# Stage 1: Build agentsview binary
FROM golang:1.25-bookworm AS builder

RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

WORKDIR /src
COPY agentsview/ .

# Build frontend and Go binary via Makefile
RUN cd frontend && npm ci
RUN make build
RUN cp agentsview /bin/agentsview

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
COPY screenshots/package.json screenshots/package-lock.json ./
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
