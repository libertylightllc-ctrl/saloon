import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const checks = [
  "dist/index.html",
  "dist/app.html",
  "dist/marketing.html",
  "dist/styles.css",
  "dist/backend.js",
  "dist/app.js",
  "dist/manifest.webmanifest",
  "dist/assets/icon.svg",
  "dist/.nojekyll"
];

for (const file of checks) {
  await stat(join(root, file));
}

const marketingHome = await readFile(join(root, "dist/index.html"), "utf8");
const html = await readFile(join(root, "dist/app.html"), "utf8");
const marketing = await readFile(join(root, "dist/marketing.html"), "utf8");
const js = await readFile(join(root, "dist/app.js"), "utf8");

const requiredHtml = [
  "id=\"loginForm\"",
  "id=\"loginShopId\"",
  "id=\"loginUsername\"",
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
  "data-export=\"csv\"",
  "data-lang=\"en\"",
  "data-lang=\"ar\"",
  "data-lang=\"hi\"",
  "data-lang=\"ur\"",
  "id=\"master-admin\"",
  "id=\"createShopBtn\"",
  "id=\"shopSwitcher\"",
  "id=\"masterShopTable\"",
  "id=\"handoverCard\"",
  "id=\"newShopCode\"",
  "id=\"newOwnerUsername\"",
  "id=\"newOwnerPassword\"",
  "id=\"createUserBtn\"",
  "id=\"userTable\"",
  "id=\"shopSearch\"",
  "id=\"shopStatusFilter\"",
  "id=\"accountSecurityForm\"",
  "id=\"changePasswordBtn\"",
  "id=\"ownerControlSummary\"",
  "id=\"ownerChecksPanel\"",
  "id=\"customerEditId\"",
  "id=\"customerFormTitle\"",
  "id=\"splitPaymentFields\"",
  "id=\"saleDiscountAmount\"",
  "id=\"saleTipAmount\"",
  "id=\"refundAmount\"",
  "id=\"purchaseEvidenceFile\"",
  "id=\"expenseEvidenceFile\"",
  "id=\"taxModeCard\"",
  "id=\"inventoryItemForm\"",
  "id=\"inventoryChangeReason\"",
  "id=\"serviceEditId\"",
  "id=\"serviceChangeReason\"",
  "id=\"supplierEditId\"",
  "id=\"supplierChangeReason\"",
  "id=\"expenseReversalField\"",
  "id=\"staffProfileFormTitle\"",
  "id=\"staffProfileEditId\"",
  "id=\"staffProfileChangeReason\"",
  "id=\"attendanceChangeReason\"",
  "id=\"payrollEvidenceFile\"",
  "id=\"inspectionChangeReason\"",
  "id=\"expiryEditId\"",
  "id=\"expiryChangeReason\"",
  "id=\"productEditId\"",
  "id=\"productEvidenceFile\"",
  "id=\"saveProductRegistration\""
  ,"id=\"accountingSourceStatus\""
  ,"id=\"createCloudBackup\""
  ,"id=\"backupTable\""
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
  "saveState",
  "shops",
  "shopStates",
  "activeShopId",
  "createShopFromForm",
  "switchShop",
  "authenticateLogin",
  "defaultShopUsers",
  "createUserFromForm",
  "deleteShop",
  "toggleShopStatus",
  "resetOwnerPassword",
  "data-delete-user",
  "data-reset-user",
  "data-delete-shop",
  "Platform Admin",
  "\"Shop Admin\": \"9999\"",
  "openPasswordDialog",
  "changePassword",
  "signEvidence",
  "canManageShopOperations",
  "data-reverse-expense",
  "recordExpense",
  "reverseExpense",
  "recordPurchase",
  "reversePurchase",
  "recordSupplierPayment",
  "reverseSupplierPayment",
  "saveInventoryItem",
  "recordStockMovement",
  "archiveInventoryItem",
  "saveService",
  "archiveService",
  "saveSupplier",
  "archiveSupplier",
  "saveCustomer",
  "recordBooking",
  "updateBookingStatus",
  "saveStaffProfile",
  "archiveStaffProfile",
  "saveAttendance",
  "recordStaffAdjustment",
  "generatePayroll",
  "payPayroll",
  "saveComplianceDocument",
  "archiveComplianceDocument",
  "signInspection",
  "recordHygieneLog",
  "saveProductRegistration",
  "archiveProductRegistration"
  ,"loadAccountingSnapshot"
  ,"createBackup"
  ,"listBackups"
  ,"getBackup"
];

const forbiddenHtml = [
  "id=\"loginRole\"",
  "data-view=\"launch-audit\"",
  "id=\"completeInspectionRound\"",
  "Staff commission</span><strong>AED 224</strong>",
  "Cash difference</span><strong class=\"negative\">AED -50</strong>",
  "id=\"dashboardPurchasesTotal\">AED 640</strong>",
  "id=\"dashboardExpensesTotal\">AED 310</strong>",
  "id=\"reportPurchases\">AED 640</strong>",
  "id=\"reportExpenses\">AED 310</strong>"
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

for (const text of ["Close the day.", "id=\"product\"", "href=\"./app.html\""]) {
  if (!marketingHome.includes(text)) throw new Error(`Missing home marketing hook: ${text}`);
}

for (const text of ["Close the day.", "id=\"product\"", "href=\"./app.html\""]) {
  if (!marketing.includes(text)) throw new Error(`Missing marketing page hook: ${text}`);
}

console.log("Validation passed");
