import base from '../../playwright.config';

/** One-off captures of real app screens for the website (not part of the test suite). */
export default {
  ...base,
  testDir: '.',
  globalSetup: '../../e2e/support/global-setup.ts',
  outputDir: '../../e2e-results/landing-shots',
  projects: [{ name: 'shots', use: { mode: 'gents', deviceScaleFactor: 2 } }],
};
