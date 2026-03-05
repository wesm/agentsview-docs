import { test, expect, Page, Locator } from '@playwright/test';
import { join } from 'path';

const DIR = process.env.SCREENSHOT_DIR || join(
  __dirname, '..', '..', 'public', 'screenshots'
);

const FULL = { width: 1440, height: 900 };

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: join(DIR, `${name}.png`),
    type: 'png',
  });
}

async function snapEl(loc: Locator, name: string) {
  await loc.screenshot({
    path: join(DIR, `${name}.png`),
    type: 'png',
  });
}

async function waitForApp(page: Page) {
  await page.goto('/');
  await page.waitForSelector('.session-item', {
    timeout: 15_000,
  });
  // Let analytics charts render
  await page.waitForTimeout(3000);
}

async function setDateRange1Y(page: Page) {
  const btn = page.locator('.preset-btn', { hasText: '1y' });
  if (await btn.count() > 0) {
    await btn.click();
    await page.waitForTimeout(3000);
  }
}

async function selectFirstSession(page: Page) {
  const items = page.locator('.session-item');
  await items.first().click();
  await page.waitForSelector('.message', { timeout: 10_000 });
  await page.waitForTimeout(1000);
}

// Find a session likely to have thinking/tool content
// by looking for ones with higher message counts
async function selectRichSession(page: Page) {
  const items = page.locator('.session-item');
  const count = await items.count();
  // Try the 3rd session (index 2) for variety, fall back to first
  const idx = Math.min(2, count - 1);
  await items.nth(idx).click();
  await page.waitForSelector('.message', { timeout: 10_000 });
  await page.waitForTimeout(1000);
}

// ── Dashboard / Analytics ───────────────────────────────

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
    await setDateRange1Y(page);
  });

  test('full dashboard', async ({ page }) => {
    await snap(page, 'dashboard');
  });

  test('summary cards', async ({ page }) => {
    const el = page.locator('.summary-cards');
    if (await el.count() > 0) {
      await snapEl(el, 'summary-cards');
    }
  });

  test('date range and toolbar', async ({ page }) => {
    const el = page.locator('.analytics-toolbar');
    if (await el.count() > 0) {
      await snapEl(el, 'date-range');
    }
  });

  test('activity heatmap', async ({ page }) => {
    const heatmap = page.locator('.heatmap-container');
    if (await heatmap.count() > 0) {
      // Wait for SVG cells to render
      await page.waitForSelector('.heatmap-cell', {
        timeout: 10_000,
      });
      await page.waitForTimeout(500);
      await snapEl(heatmap, 'heatmap');
    }
  });

  test('heatmap click-to-filter', async ({ page }) => {
    // Click a cell with data (has .clickable class)
    const clickable = page.locator('.heatmap-cell.clickable');
    if (await clickable.count() > 0) {
      await clickable.first().click();
      await page.waitForTimeout(2000);
      await snap(page, 'heatmap-filtered');
      // Click again to deselect
      const selected = page.locator('.heatmap-cell.selected');
      if (await selected.count() > 0) {
        await selected.first().click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('hour of week heatmap', async ({ page }) => {
    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && (text.includes('Hour') || text.includes('Week'))) {
        await snapEl(panels.nth(i), 'hour-of-week');
        break;
      }
    }
  });

  test('activity timeline', async ({ page }) => {
    // ActivityTimeline is the 3rd chart-panel (index 2)
    const panel = page.locator('.chart-panel').nth(2);
    if (await panel.count() > 0) {
      const timeline = panel.locator('.timeline-container');
      if (await timeline.count() > 0) {
        await page.waitForSelector('.timeline-svg', {
          timeout: 10_000,
        });
        await page.waitForTimeout(500);
      }
      await snapEl(panel, 'activity-timeline');
    }
  });

  test('top sessions', async ({ page }) => {
    // Scroll down to find top sessions
    const content = page.locator('.analytics-content');
    await content.evaluate(
      (el) => el.scrollTo(0, el.scrollHeight / 3)
    );
    await page.waitForTimeout(500);

    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && text.includes('Top')) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snapEl(panels.nth(i), 'top-sessions');
        break;
      }
    }
  });

  test('project breakdown', async ({ page }) => {
    const content = page.locator('.analytics-content');
    await content.evaluate(
      (el) => el.scrollTo(0, el.scrollHeight / 3)
    );
    await page.waitForTimeout(500);

    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && text.includes('Project')) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snapEl(panels.nth(i), 'project-breakdown');
        break;
      }
    }
  });

  test('session shape', async ({ page }) => {
    const content = page.locator('.analytics-content');
    await content.evaluate(
      (el) => el.scrollTo(0, el.scrollHeight / 2)
    );
    await page.waitForTimeout(500);

    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && (text.includes('Shape') || text.includes('Distribution'))) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snapEl(panels.nth(i), 'session-shape');
        break;
      }
    }
  });

  test('tool usage', async ({ page }) => {
    const content = page.locator('.analytics-content');
    await content.evaluate(
      (el) => el.scrollTo(0, (el.scrollHeight * 2) / 3)
    );
    await page.waitForTimeout(500);

    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && text.includes('Tool')) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snapEl(panels.nth(i), 'tool-usage');
        break;
      }
    }
  });

  test('velocity metrics', async ({ page }) => {
    const content = page.locator('.analytics-content');
    await content.evaluate(
      (el) => el.scrollTo(0, (el.scrollHeight * 3) / 4)
    );
    await page.waitForTimeout(500);

    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && text.includes('Velocity')) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snapEl(panels.nth(i), 'velocity');
        break;
      }
    }
  });

  test('agent comparison', async ({ page }) => {
    const content = page.locator('.analytics-content');
    await content.evaluate(
      (el) => el.scrollTo(0, el.scrollHeight)
    );
    await page.waitForTimeout(500);

    const panels = page.locator('.chart-panel');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text && text.includes('Agent')) {
        await panels.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await snapEl(panels.nth(i), 'agent-comparison');
        break;
      }
    }
  });
});

// ── Session browser ─────────────────────────────────────

test.describe('Session browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  test('session list', async ({ page }) => {
    const sidebar = page.locator('.sidebar');
    if (await sidebar.count() > 0) {
      await snapEl(sidebar, 'session-list');
    }
  });

  test('project filter', async ({ page }) => {
    // Select a project from the dropdown
    const select = page.locator('.project-select');
    if (await select.count() > 0) {
      await select.selectOption({ index: 1 });
      await page.waitForTimeout(1000);
      await snap(page, 'session-filtered');
    }
  });

  test('session filter dropdown', async ({ page }) => {
    const filterBtn = page.locator('button.filter-btn');
    if (await filterBtn.count() > 0) {
      await filterBtn.click();
      await page.waitForTimeout(300);
      await snap(page, 'session-filters');
    }
  });

  test('session filters active', async ({ page }) => {
    const filterBtn = page.locator('button.filter-btn');
    if (await filterBtn.count() > 0) {
      await filterBtn.click();
      await page.waitForTimeout(300);

      // Select "Min Prompts 10" filter
      const minPrompts = page.getByRole('button', {
        name: '10',
        exact: true,
      });
      if (await minPrompts.count() > 0) {
        await minPrompts.click();
        await page.waitForTimeout(300);
      }

      // Select an agent filter
      const agentBtn = page.locator(
        'button.agent-filter-btn'
      ).first();
      if (await agentBtn.count() > 0) {
        await agentBtn.click();
        await page.waitForTimeout(300);
      }

      await snap(page, 'session-filters-active');

      // Clean up
      const clear = page.locator('button.clear-filters-btn');
      if (await clear.count() > 0) await clear.click();
    }
  });

  test('starred session', async ({ page }) => {
    // Star the first session using 's' key
    await selectFirstSession(page);
    await page.keyboard.press('s');
    await page.waitForTimeout(500);

    const sidebar = page.locator('.sidebar');
    if (await sidebar.count() > 0) {
      await snapEl(sidebar, 'starred-session');
    }

    // Unstar to clean up
    await page.keyboard.press('s');
  });

  test('group by agent', async ({ page }) => {
    // Find and click the group-by-agent toggle
    const groupBtn = page.locator(
      'button[title*="group"], button[title*="Group"]'
    );
    if (await groupBtn.count() > 0) {
      await groupBtn.click();
      await page.waitForTimeout(500);

      // Expand the first group
      const groupHeader = page.locator(
        '.agent-group-header'
      ).first();
      if (await groupHeader.count() > 0) {
        await groupHeader.click();
        await page.waitForTimeout(300);
      }

      const sidebar = page.locator('.sidebar');
      await snapEl(sidebar, 'group-by-agent');

      // Toggle off to clean up
      await groupBtn.click();
    }
  });
});

// ── Message viewer ──────────────────────────────────────

test.describe('Message viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  test('full message view', async ({ page }) => {
    await selectRichSession(page);
    await snap(page, 'message-viewer');
  });

  test('thinking blocks', async ({ page }) => {
    await selectRichSession(page);
    // showThinking defaults to true — don't press 't'
    await page.waitForTimeout(500);

    // Look for a thinking block already visible
    const thinking = page.locator('.thinking-block').first();
    if (await thinking.isVisible()) {
      await snapEl(thinking, 'thinking-blocks');
    } else {
      // Scroll through messages to find one
      const rows = page.locator('.message, .virtual-row');
      const count = await rows.count();
      for (let i = 0; i < Math.min(count, 40); i++) {
        await rows.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        const tb = page.locator('.thinking-block').first();
        if (await tb.isVisible()) {
          await snapEl(tb, 'thinking-blocks');
          break;
        }
      }
    }
  });

  test('tool blocks', async ({ page }) => {
    await selectRichSession(page);

    const tool = page.locator('.tool-block').first();
    if (await tool.isVisible()) {
      // Expand it
      const header = tool.locator('.tool-header');
      if (await header.count() > 0) {
        await header.click();
        await page.waitForTimeout(300);
      }
      await snapEl(tool, 'tool-blocks');
    } else {
      // Scroll to find one
      const messages = page.locator('.message');
      const count = await messages.count();
      for (let i = 0; i < Math.min(count, 20); i++) {
        await messages.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        const tb = page.locator('.tool-block').first();
        if (await tb.isVisible()) {
          const hdr = tb.locator('.tool-header');
          if (await hdr.count() > 0) await hdr.click();
          await page.waitForTimeout(300);
          await snapEl(tb, 'tool-blocks');
          break;
        }
      }
    }
  });

  test('tool call groups', async ({ page }) => {
    await selectRichSession(page);

    const group = page.locator('.tool-group').first();
    if (await group.isVisible()) {
      await snapEl(group, 'tool-groups');
    } else {
      const messages = page.locator('.virtual-row');
      const count = await messages.count();
      for (let i = 0; i < Math.min(count, 30); i++) {
        await messages.nth(i).scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        const tg = page.locator('.tool-group').first();
        if (await tg.isVisible()) {
          await snapEl(tg, 'tool-groups');
          break;
        }
      }
    }
  });

  test('compact layout', async ({ page }) => {
    await selectRichSession(page);

    // Press 'l' to cycle to compact layout
    await page.keyboard.press('l');
    await page.waitForTimeout(500);

    // Verify we're in compact layout
    const list = page.locator('.layout-compact');
    if (await list.count() > 0) {
      await snap(page, 'layout-compact');
    }

    // Cycle back to default
    await page.keyboard.press('l');
    await page.keyboard.press('l');
  });

  test('stream layout', async ({ page }) => {
    await selectRichSession(page);

    // Press 'l' twice to reach stream layout
    await page.keyboard.press('l');
    await page.keyboard.press('l');
    await page.waitForTimeout(500);

    const list = page.locator('.layout-stream');
    if (await list.count() > 0) {
      await snap(page, 'layout-stream');
    }

    // Cycle back to default
    await page.keyboard.press('l');
  });

  test('block-type filter dropdown', async ({ page }) => {
    await selectRichSession(page);

    // Click the block-type filter button
    const filterBtn = page.locator(
      'button[title="Filter block types"]'
    );
    if (await filterBtn.count() > 0) {
      await filterBtn.click();
      await page.waitForTimeout(300);

      const dropdown = page.locator('.block-filter-dropdown');
      if (await dropdown.count() > 0) {
        await snapEl(dropdown, 'block-filter');
      }

      // Close by clicking elsewhere
      await page.keyboard.press('Escape');
    }
  });

  test('copy button on message', async ({ page }) => {
    await selectRichSession(page);

    // Hover over a message to reveal the copy button
    const message = page.locator('.message').first();
    if (await message.count() > 0) {
      await message.hover();
      await page.waitForTimeout(300);

      const copyBtn = message.locator('.copy-btn');
      if (await copyBtn.count() > 0) {
        await snapEl(message, 'message-copy-btn');
      }
    }
  });
});

// ── Command palette & search ────────────────────────────

test.describe('Command palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  test('recent sessions', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.palette-overlay', {
      timeout: 5_000,
    });
    await page.waitForTimeout(500);
    await snap(page, 'command-palette');
  });

  test('search results', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.palette-overlay', {
      timeout: 5_000,
    });

    const input = page.locator('.palette-input');
    await input.fill('implement');
    await page.waitForTimeout(1500);
    await snap(page, 'search-results');
  });
});

// ── Modals ──────────────────────────────────────────────

test.describe('Modals', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  test('shortcuts modal', async ({ page }) => {
    await page.keyboard.press('?');
    await page.waitForSelector('.shortcuts-overlay', {
      timeout: 5_000,
    });
    await page.waitForTimeout(300);
    await snap(page, 'shortcuts-modal');
  });

  test('resync modal', async ({ page }) => {
    const gear = page.locator('button[title="Full resync"]');
    if (await gear.count() > 0) {
      await gear.click();
      await page.waitForSelector('.resync-panel', {
        timeout: 5_000,
      });
      await page.waitForTimeout(300);
      await snap(page, 'resync-modal');
      await page.keyboard.press('Escape');
    }
  });

  test('publish modal', async ({ page }) => {
    await selectFirstSession(page);
    await page.keyboard.press('p');
    await page.waitForTimeout(500);

    const modal = page.locator(
      '.publish-overlay, .publish-modal'
    );
    if (await modal.count() > 0) {
      await snap(page, 'publish-modal');
    }
    await page.keyboard.press('Escape');
  });
});

// ── Insights ────────────────────────────────────────────

test.describe('Insights', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
  });

  async function navigateToInsights(page: Page) {
    const navBtn = page.locator('.nav-btn', { hasText: 'Insights' });
    await navBtn.click();
    await page.waitForSelector('.insights-page', {
      timeout: 10_000,
    });
    await page.waitForTimeout(1000);
  }

  test('full insights page', async ({ page }) => {
    await navigateToInsights(page);

    // Select the first completed insight (weekly analysis)
    const rows = page.locator('.insight-row');
    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(500);
    }
    await snap(page, 'insights');
  });

  test('insight content', async ({ page }) => {
    await navigateToInsights(page);

    // Select the first insight to show content
    const rows = page.locator('.insight-row');
    if (await rows.count() > 0) {
      await rows.first().click();
      await page.waitForTimeout(500);
    }

    const content = page.locator('.content-panel');
    if (await content.count() > 0) {
      await snapEl(content, 'insight-content');
    }
  });
});

// ── Themes ──────────────────────────────────────────────

test.describe('Themes', () => {
  test('dark theme session view', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
    await selectRichSession(page);

    // Ensure dark mode
    const isDark = await page.evaluate(
      () => document.documentElement.classList.contains('dark')
    );
    if (!isDark) {
      // Find and click theme toggle
      const btns = page.locator('.header-btn');
      const count = await btns.count();
      for (let i = 0; i < count; i++) {
        const title = await btns.nth(i).getAttribute('title');
        const aria = await btns.nth(i).getAttribute('aria-label');
        const text = (title || '') + (aria || '');
        if (text.toLowerCase().includes('theme')) {
          await btns.nth(i).click();
          await page.waitForTimeout(500);
          break;
        }
      }
    }
    await snap(page, 'theme-dark');
  });

  test('light theme session view', async ({ page }) => {
    await page.setViewportSize(FULL);
    await waitForApp(page);
    await selectRichSession(page);

    // Switch to light mode
    const isDark = await page.evaluate(
      () => document.documentElement.classList.contains('dark')
    );
    if (isDark) {
      const btns = page.locator('.header-btn');
      const count = await btns.count();
      for (let i = 0; i < count; i++) {
        const title = await btns.nth(i).getAttribute('title');
        const aria = await btns.nth(i).getAttribute('aria-label');
        const text = (title || '') + (aria || '');
        if (text.toLowerCase().includes('theme')) {
          await btns.nth(i).click();
          await page.waitForTimeout(500);
          break;
        }
      }
    }
    await snap(page, 'theme-light');
  });
});
