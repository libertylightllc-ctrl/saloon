import { test as base, expect, type Browser, type Page } from '@playwright/test';

import type { Mode } from './api';

export interface Options {
  mode: Mode;
}

/** Colours that only the chosen theme uses (src/theme/gents.ts, ladies.ts). */
export const THEME = {
  gents: { primaryText: 'rgb(108, 69, 242)', primaryAction: 'rgb(108, 69, 242)', staff: 'Barber', anyStaff: 'Any barber' },
  ladies: { primaryText: 'rgb(184, 70, 75)', primaryAction: 'rgb(224, 96, 106)', staff: 'Stylist', anyStaff: 'Any stylist' },
} as const;

/** Records API errors, failed requests and console errors of a page, with timestamps. */
function recordNetwork(page: Page, label: string, lines: string[]) {
  const t0 = Date.now();
  const at = () => `${label} +${((Date.now() - t0) / 1000).toFixed(1)}s`;
  page.on('response', (r) => {
    if (r.url().includes(':54321') && r.status() >= 400) lines.push(`${at()} ${r.status()} ${r.request().method()} ${r.url().split('?')[0]}`);
  });
  page.on('requestfailed', (r) => {
    if (r.url().includes(':54321')) lines.push(`${at()} FAILED ${r.method()} ${r.url().split('?')[0]} ${r.failure()?.errorText}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') lines.push(`${at()} console.error ${m.text().slice(0, 200)}`);
  });
}

export const test = base.extend<Options & { device: (name?: string) => Promise<Page>; network: string[] }>({
  mode: ['gents', { option: true }],
  /** Attached to failed tests so a failure shows what the server said, not just what the screen did. */
  network: [
    async ({ page }, use, testInfo) => {
      const lines: string[] = [];
      recordNetwork(page, 'phone A', lines);
      await use(lines);
      if (testInfo.status !== testInfo.expectedStatus && lines.length) {
        await testInfo.attach('network-and-console', { body: lines.join('\n'), contentType: 'text/plain' });
        console.log(`--- network/console for "${testInfo.title}" [${testInfo.project.name}]\n${lines.join('\n')}`);
      }
    },
    { auto: true },
  ],
  /** A second (third…) phone: a fresh browser context with its own storage. */
  device: async ({ browser, network }, use) => {
    const contexts: Awaited<ReturnType<Browser['newContext']>>[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      recordNetwork(page, `phone ${String.fromCharCode(65 + contexts.length)}`, network);
      return page;
    });
    for (const c of contexts) await c.close();
  },
});

export { expect };
