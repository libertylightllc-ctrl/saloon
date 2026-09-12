import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("mobile projects share the production web build safely", async () => {
  const [pkgText, configText, build, workflow, manifest] = await Promise.all([
    read("package.json"),
    read("capacitor.config.json"),
    read("scripts/build.mjs"),
    read(".github/workflows/mobile.yml"),
    read("manifest.webmanifest"),
  ]);
  const pkg = JSON.parse(pkgText);
  const config = JSON.parse(configText);

  assert.equal(config.appId, "com.saloncontrol.app");
  assert.equal(config.webDir, "dist");
  assert.match(pkg.scripts["mobile:sync"], /build:mobile.*cap sync/);
  assert.match(build, /--mobile/);
  assert.match(build, /app\.html.*index\.html/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.doesNotMatch(workflow, /password|keystore|mobileprovision/i);
  assert.match(manifest, /\.\/icons\/icon-512\.webp/);
  assert.match(manifest, /image\/webp/);
});
