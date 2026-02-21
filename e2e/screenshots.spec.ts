import { test, expect, Page } from '@playwright/test';
import { join } from 'path';

const SCREENSHOT_DIR = join(__dirname, '..', 'public', 'screenshots');

// Viewport sizes
const FULL = { width: 1440, height: 900 };

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: join(SCREENSHOT_DIR, `${name}.png`),
    type: 'png',
  });
}

async function waitForApp(page: Page) {
  await page.goto('/');
  // Wait for sessions to load in sidebar
  await page.waitForSelector('.session-item', { timeout: 15_000 });
  // Give charts a moment to render
  await page.waitForTimeout(2000);
}

test.describe('Dashboard screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  test('full dashboard', async ({ page }) => {
    await screenshot(page, 'dashboard');
  });

  test('summary cards', async ({ page }) => {
    const cards = page.locator('.summary-cards');
    if (await cards.count() > 0) {
      await cards.screenshot({
        path: join(SCREENSHOT_DIR, 'summary-cards.png'),
      });
    }
  });

  test('date range picker', async ({ page }) => {
    const toolbar = page.locator('.analytics-toolbar');
    if (await toolbar.count() > 0) {
      await toolbar.screenshot({
        path: join(SCREENSHOT_DIR, 'date-range.png'),
      });
    }
  });

  test('activity heatmap', async ({ page }) => {
    const heatmap = page.locator('.heatmap-chart').first();
    if (await heatmap.count() > 0) {
      await heatmap.screenshot({
        path: join(SCREENSHOT_DIR, 'heatmap.png'),
      });
    }
  });

  test('hour of week heatmap', async ({ page }) => {
    const chart = page.locator('.hour-of-week-chart').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'hour-of-week.png'),
      });
    }
  });

  test('activity timeline', async ({ page }) => {
    const chart = page.locator('.activity-timeline').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'activity-timeline.png'),
      });
    }
  });

  test('top sessions', async ({ page }) => {
    const chart = page.locator('.top-sessions').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'top-sessions.png'),
      });
    }
  });

  test('project breakdown', async ({ page }) => {
    const chart = page.locator('.project-breakdown').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'project-breakdown.png'),
      });
    }
  });

  test('session shape', async ({ page }) => {
    const chart = page.locator('.session-shape').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'session-shape.png'),
      });
    }
  });

  test('tool usage', async ({ page }) => {
    const chart = page.locator('.tool-usage').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'tool-usage.png'),
      });
    }
  });

  test('velocity metrics', async ({ page }) => {
    const chart = page.locator('.velocity-metrics').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'velocity.png'),
      });
    }
  });

  test('agent comparison', async ({ page }) => {
    const chart = page.locator('.agent-comparison').first();
    if (await chart.count() > 0) {
      await chart.screenshot({
        path: join(SCREENSHOT_DIR, 'agent-comparison.png'),
      });
    }
  });
});

test.describe('Session viewer screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  test('session list', async ({ page }) => {
    const sidebar = page.locator('.session-list');
    if (await sidebar.count() > 0) {
      await sidebar.screenshot({
        path: join(SCREENSHOT_DIR, 'session-list.png'),
      });
    }
  });

  test('message viewer', async ({ page }) => {
    // Select the first session with decent message count
    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1000);
    await screenshot(page, 'message-viewer');
  });

  test('thinking blocks', async ({ page }) => {
    // Select a session and enable thinking blocks
    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });

    // Toggle thinking on
    await page.keyboard.press('t');
    await page.waitForTimeout(500);

    // Find and screenshot a thinking block if visible
    const thinking = page.locator('.thinking-block').first();
    if (await thinking.isVisible()) {
      await thinking.screenshot({
        path: join(SCREENSHOT_DIR, 'thinking-blocks.png'),
      });
    } else {
      await screenshot(page, 'thinking-blocks');
    }
  });

  test('tool blocks', async ({ page }) => {
    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    const toolBlock = page.locator('.tool-block').first();
    if (await toolBlock.isVisible()) {
      await toolBlock.screenshot({
        path: join(SCREENSHOT_DIR, 'tool-blocks.png'),
      });
    }
  });

  test('tool call groups', async ({ page }) => {
    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);

    const group = page.locator('.tool-call-group').first();
    if (await group.isVisible()) {
      await group.screenshot({
        path: join(SCREENSHOT_DIR, 'tool-groups.png'),
      });
    }
  });
});

test.describe('Command palette screenshots', () => {
  test('command palette empty', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);

    // Open command palette
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('.command-palette', {
      timeout: 5_000,
    });
    await page.waitForTimeout(500);
    await screenshot(page, 'command-palette');
  });

  test('search results', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);

    // Open command palette and search
    await page.keyboard.press('Meta+k');
    await page.waitForSelector('.command-palette', {
      timeout: 5_000,
    });

    const input = page.locator('.command-palette input');
    await input.fill('function');
    // Wait for search results
    await page.waitForTimeout(1000);
    await screenshot(page, 'search-results');
  });
});

test.describe('Modal screenshots', () => {
  test('publish modal', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);

    // Select a session first
    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });

    // Open publish modal
    await page.keyboard.press('p');
    await page.waitForTimeout(500);

    const modal = page.locator('.publish-modal, .modal-overlay');
    if (await modal.count() > 0) {
      await screenshot(page, 'publish-modal');
    }

    // Close
    await page.keyboard.press('Escape');
  });

  test('shortcuts modal', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);

    // Open shortcuts modal
    await page.keyboard.press('?');
    await page.waitForTimeout(500);
    await screenshot(page, 'shortcuts-modal');
  });
});

test.describe('Theme screenshots', () => {
  test('dark theme', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);

    // Ensure dark theme
    const html = page.locator('html');
    const isDark = await html.evaluate(
      (el) => el.classList.contains('dark')
    );
    if (!isDark) {
      const themeBtn = page.locator('.theme-toggle, [aria-label*="theme"]');
      if (await themeBtn.count() > 0) {
        await themeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Select a session for a richer view
    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);
    await screenshot(page, 'theme-dark');
  });

  test('light theme', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);

    // Switch to light theme
    const html = page.locator('html');
    const isDark = await html.evaluate(
      (el) => el.classList.contains('dark')
    );
    if (isDark) {
      const themeBtn = page.locator('.theme-toggle, [aria-label*="theme"]');
      if (await themeBtn.count() > 0) {
        await themeBtn.click();
        await page.waitForTimeout(500);
      }
    }

    const items = page.locator('.session-item');
    await items.first().click();
    await page.waitForSelector('.message-content', {
      timeout: 10_000,
    });
    await page.waitForTimeout(500);
    await screenshot(page, 'theme-light');
  });
});
