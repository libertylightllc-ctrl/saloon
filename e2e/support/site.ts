/**
 * The website's home page built into a temporary folder (scripts/site/build.mjs) and served with vercel.json's rules
 * (scripts/serve-web.mjs), once per worker, for the website's tests. The app itself is a stand-in page.
 */
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test } from './fixtures';

export const APP = '<!doctype html><title>app</title><p id="app">the app</p>';

/** Builds and serves the site for this file's tests on `port` + the worker's number; returns its address. */
export function useSite(port: number): () => string {
  let dist = '';
  let server: ChildProcess | null = null;
  let site = '';
  test.beforeAll(async ({}, info) => {
    dist = mkdtempSync(join(tmpdir(), 'saloqo-site-'));
    writeFileSync(join(dist, 'index.html'), APP);
    execFileSync('node', ['scripts/site/build.mjs', dist], { stdio: 'pipe' });
    site = `http://127.0.0.1:${port + info.workerIndex}`;
    server = spawn('node', ['scripts/serve-web.mjs', String(port + info.workerIndex), dist], { stdio: 'pipe' });
    // Fails at once when the server cannot start (e.g. its port is taken) instead of waiting out the hook.
    await new Promise<void>((done, fail) => {
      server!.stdout!.once('data', () => done());
      server!.once('exit', (code) => fail(new Error(`The site server on ${site} stopped (${code}).`)));
    });
  });
  test.afterAll(() => {
    server?.kill();
    rmSync(dist, { recursive: true, force: true });
  });
  return () => site;
}
