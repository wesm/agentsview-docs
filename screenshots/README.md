# Screenshot Pipeline

Generates screenshots for the docs site using Playwright inside Docker.

## Prerequisites

- Docker
- agentsview source at `~/code/agentsview` (override with `AGENTSVIEW_SRC`)
- A sessions database at `~/.agentsview/sessions.db` (override with `SOURCE_DB`)

## Run all screenshots

```bash
./screenshots/run.sh
```

Output goes to `public/screenshots/`.

## Run a single screenshot

Pass `--grep` with the test name:

```bash
./screenshots/run.sh --grep "session filters active"
```

Any extra arguments are forwarded to `npx playwright test` inside the container.

## How it works

1. Assembles a Docker build context with the agentsview source, sessions database, and test files
2. Builds a multi-stage Docker image:
   - **Stage 1 (builder):** Compiles the agentsview Go binary with frontend assets
   - **Stage 2 (db):** Extracts a test database with only open-source projects
   - **Stage 3 (playwright):** Installs Playwright + Chromium, copies binary and DB
3. Runs the container, which starts agentsview on port 8090, prunes one-shot sessions, and executes the Playwright tests
4. Screenshots are written to the mounted `/output` volume (`public/screenshots/`)

Stages 1 and 2 are cached by Docker, so re-runs after test file changes are fast.

## Configuration

Viewport: 1440x900, dark mode, `America/Chicago` timezone. See `playwright.config.ts`.

## Test file

All tests live in `tests/screenshots.spec.ts`. Each test navigates to a UI state and calls `snap(page, 'name')` or `snapEl(locator, 'name')` to capture a PNG.
