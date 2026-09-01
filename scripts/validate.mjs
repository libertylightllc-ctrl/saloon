import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checks = [
  "dist/index.html",
  "dist/styles.css",
  "dist/app.js",
  "dist/manifest.webmanifest",
  "dist/assets/icon.svg",
  "dist/.nojekyll"
];

for (const file of checks) {
  await stat(join(root, file));
}

const html = await readFile(join(root, "dist/index.html"), "utf8");
const js = await readFile(join(root, "dist/app.js"), "utf8");

const requiredHtml = [
  "id=\"loginForm\"",
  "id=\"purchaseTable\"",
  "id=\"expenseTable\"",
  "id=\"serviceNameAr\"",
  "id=\"vatModeSelect\"",
  "id=\"printReport\""
];

const requiredJs = [
  "localStorage",
  "updatePurchaseCalculation",
  "renderPurchaseTable",
  "renderExpenseTable",
  "syncLanguageButtons",
  "saveState"
];

for (const text of requiredHtml) {
  if (!html.includes(text)) throw new Error(`Missing HTML hook: ${text}`);
}

for (const text of requiredJs) {
  if (!js.includes(text)) throw new Error(`Missing JS behavior: ${text}`);
}

console.log("Validation passed");
