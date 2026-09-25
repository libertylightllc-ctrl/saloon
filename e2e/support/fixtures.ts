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

export const test = base.extend<Options & { device: (name?: string) => Promise<Page> }>({
  mode: ['gents', { option: true }],
  /** A second (third…) phone: a fresh browser context with its own storage. */
  device: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<Browser['newContext']>>[] = [];
    await use(async () => {
      const context = await browser.newContext();
      contexts.push(context);
      return context.newPage();
    });
    for (const c of contexts) await c.close();
  },
});

export { expect };
