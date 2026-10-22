import base from '../../playwright.config';

/** One-off captures of real app screens for the website (not part of the test suite). */
export default {
  ...base,
  testDir: '.',
  // *.shot.ts, so the unit tests (jest) do not pick them up.
  testMatch: '*.shot.ts',
  globalSetup: '../../e2e/support/global-setup.ts',
  outputDir: '../../e2e-results/landing-shots',
  projects: [{ name: 'shots', use: { mode: 'gents', deviceScaleFactor: 2 } }],
};
