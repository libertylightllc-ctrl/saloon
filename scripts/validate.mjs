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
  "id=\"loginPin\"",
  "id=\"loginError\"",
  "id=\"purchaseTable\"",
  "id=\"dashboardPurchasesTotal\"",
  "id=\"dashboardExpensesTotal\"",
  "id=\"expenseTable\"",
  "id=\"compliance\"",
  "id=\"inspectionRecordTable\"",
  "id=\"hygieneLogTable\"",
  "id=\"montajiTable\"",
  "id=\"serviceNameAr\"",
  "data-category=\"All\"",
  "data-checklist=\"servicesApproved\"",
  "id=\"approveClosing\"",
  "id=\"auditList\"",
  "id=\"vatModeSelect\"",
  "id=\"printReport\"",
  "data-export=\"csv\""
];

const requiredJs = [
  "localStorage",
  "rolePins",
  "roleAccess",
  "sales",
  "auditLog",
  "createdAt",
  "escapeHtml",
  "updatePurchaseCalculation",
  "updateClosingCalculation",
  "renderPurchaseTable",
  "renderExpenseTable",
  "renderCompliance",
  "inspectionRecords",
  "hygieneLogs",
  "montajiItems",
  "renderAuditLog",
  "syncLanguageButtons",
  "saveState"
];

const forbiddenHtml = [
  "id=\"completeInspectionRound\"",
  "Staff commission</span><strong>AED 224</strong>",
  "Cash difference</span><strong class=\"negative\">AED -50</strong>"
];

const forbiddenJs = [
  "salesTotal",
  "expectedCash: 1245",
  "is ready through Print / Save PDF",
  "inspection round completed"
];

for (const text of requiredHtml) {
  if (!html.includes(text)) throw new Error(`Missing HTML hook: ${text}`);
}

for (const text of requiredJs) {
  if (!js.includes(text)) throw new Error(`Missing JS behavior: ${text}`);
}

for (const text of forbiddenHtml) {
  if (html.includes(text)) throw new Error(`Forbidden HTML regression: ${text}`);
}

for (const text of forbiddenJs) {
  if (js.includes(text)) throw new Error(`Forbidden JS regression: ${text}`);
}

console.log("Validation passed");
