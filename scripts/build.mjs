import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const files = ["index.html", "app.html", "marketing.html", "styles.css", "backend.js", "app.js", "manifest.webmanifest"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const file of files) {
  await cp(join(root, file), join(dist, file));
}

if (process.argv.includes("--mobile")) {
  await cp(join(root, "app.html"), join(dist, "index.html"));
}

await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });
await cp(join(root, "icons"), join(dist, "icons"), { recursive: true });
await writeFile(join(dist, ".nojekyll"), "");

console.log("Built Salon Control into dist/");
