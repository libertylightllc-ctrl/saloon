const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3z"/><path d="M13 21h8V3h-8z"/><path d="M3 21h8v-6H3z"/></svg>',
  setup: '<svg viewBox="0 0 24 24"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h10"/><path d="m15 18 2 2 4-4"/></svg>',
  sale: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  services: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>',
  purchase: '<svg viewBox="0 0 24 24"><path d="M6 2v4"/><path d="M18 2v4"/><path d="M3 6h18v16H3z"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>',
  expense: '<svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  stock: '<svg viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z"/><path d="M7 8v8"/><path d="M17 8v8"/></svg>',
  cash: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01"/><path d="M18 14h.01"/></svg>',
  report: '<svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 14h2v3H7z"/><path d="M12 10h2v7h-2z"/><path d="M17 7h2v10h-2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 0 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.56.6 1 .6h.6a2 2 0 0 1 0 4h-.6a1.7 1.7 0 0 0-1 .6Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
};

const storageKey = "salon-control-mvp";

const serviceTranslations = {
  Haircut: { ar: "قص شعر", hi: "हेयरकट", ur: "بال کٹوانا" },
  Shave: { ar: "حلاقة", hi: "शेव", ur: "شیو" },
  "Beard Trim": { ar: "تشذيب اللحية", hi: "दाढ़ी ट्रिम", ur: "داڑھی ٹرم" },
  "Beard Color": { ar: "لون اللحية", hi: "दाढ़ी कलर", ur: "داڑھی رنگ" },
  "Hair Color": { ar: "صبغ الشعر", hi: "हेयर कलर", ur: "بالوں کا رنگ" },
  Facial: { ar: "تنظيف البشرة", hi: "फेशियल", ur: "فیشل" },
  "Head Massage": { ar: "مساج الرأس", hi: "हेड मसाज", ur: "سر کا مساج" }
};

const languageLabels = {
  en: "English",
  ar: "Arabic",
  hi: "Hindi",
  ur: "Urdu"
};

const defaultState = {
  services: [
    { name: "Haircut", names: { ar: "قص شعر", hi: "हेयरकट", ur: "بال کٹوانا" }, category: "Hair", price: 25, recipe: "Neck strip 1, shampoo optional", active: true },
    { name: "Shave", names: { ar: "حلاقة", hi: "शेव", ur: "شیو" }, category: "Beard", price: 15, recipe: "Blade 1, foam 8ml, tissue 2", active: true },
    { name: "Beard Trim", names: { ar: "تشذيب اللحية", hi: "दाढ़ी ट्रिम", ur: "داڑھی ٹرم" }, category: "Beard", price: 10, recipe: "Machine use, tissue 1", active: true },
    { name: "Beard Color", names: { ar: "لون اللحية", hi: "दाढ़ी कलर", ur: "داڑھی رنگ" }, category: "Color", price: 45, recipe: "Beard color 20ml, developer 20ml, gloves 1 pair", active: true },
    { name: "Hair Color", names: { ar: "صبغ الشعر", hi: "हेयर कलर", ur: "بالوں کا رنگ" }, category: "Color", price: 80, recipe: "Color 60ml, developer 60ml, gloves 1 pair", active: true },
    { name: "Facial", names: { ar: "تنظيف البشرة", hi: "फेशियल", ur: "فیشل" }, category: "Face", price: 60, recipe: "Cream 10ml, mask 1, towel laundry", active: true },
    { name: "Head Massage", names: { ar: "مساج الرأس", hi: "हेड मसाज", ur: "سر کا مساج" }, category: "Massage", price: 35, recipe: "Oil 15ml, towel laundry", active: true }
  ],
  purchases: [
    { supplier: "Beauty Supply LLC", type: "Consumable stock", item: "Blades, foam, tissues", qty: 1, unit: "bill", unitCost: 420, discount: 0, payment: "Cash" },
    { supplier: "Color House", type: "Consumable stock", item: "Hair color, developer", qty: 1, unit: "bill", unitCost: 220, discount: 0, payment: "Card" },
    { supplier: "Gulf Salon Tools", type: "Reusable tool / asset", item: "Clipper machine", qty: 1, unit: "piece", unitCost: 250, discount: 0, payment: "Bank" }
  ],
  expenses: [
    { category: "Tea & Food", amount: 35, payment: "Cash", note: "Tea and water for staff" },
    { category: "Dry Cleaning", amount: 85, payment: "Cash", note: "Towels and capes" },
    { category: "Transport", amount: 40, payment: "Cash", note: "Supplier pickup" }
  ],
  receiptEnabled: false,
  vatEnabled: false,
  salesTotal: 1870,
  expectedCash: 1245
};

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(storageKey) || "{}") };
  } catch {
    return { ...defaultState };
  }
}

let state = loadState();
let services = state.services;
let purchases = state.purchases;
let expenses = state.expenses;
let selectedService = services[0];
let receiptEnabled = state.receiptEnabled;
let vatEnabled = state.vatEnabled;
let salesTotal = state.salesTotal;
let expectedCash = state.expectedCash;
let activeLanguage = state.activeLanguage || "en";

function migrateServices() {
  services = services.map((service) => ({
    ...service,
    names: {
      ...(serviceTranslations[service.name] || {}),
      ...(service.names || {})
    }
  }));
  state.services = services;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify({
    services,
    purchases,
    expenses,
    receiptEnabled,
    vatEnabled,
    salesTotal,
    expectedCash,
    activeLanguage
  }));
}

document.querySelectorAll("[data-icon]").forEach((element) => {
  const icon = icons[element.dataset.icon];
  if (icon) element.innerHTML = icon;
});

const titles = {
  dashboard: "Daily Control Dashboard",
  setup: "Launch Setup",
  "quick-sale": "Quick Sale",
  services: "Editable Service Catalog",
  purchases: "Purchases",
  expenses: "Expenses",
  inventory: "Inventory & Tools",
  cash: "Cash Closing",
  reports: "Reports",
  settings: "Settings"
};

function showView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add("active");
  document.getElementById("viewTitle").textContent = titles[viewId] || "Salon Control";
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.view));
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.jump));
});

function money(amount) {
  return `AED ${amount.toLocaleString("en-AE")}`;
}

function serviceName(service, language = activeLanguage) {
  if (language === "en") return service.name;
  return service.names?.[language] || service.name;
}

function isRtlLanguage(language = activeLanguage) {
  return language === "ar" || language === "ur";
}

function syncSelectedServiceLabel() {
  const label = document.getElementById("selectedService");
  label.textContent = `${serviceName(selectedService)} · ${money(selectedService.price || 0)}`;
  label.classList.toggle("rtl-preview", isRtlLanguage());
}

function syncLanguageButtons() {
  document.querySelectorAll(".language-switch button").forEach((button) => {
    const language = button.textContent.trim().toLowerCase();
    button.classList.toggle("active", language === activeLanguage);
  });
  document.body.classList.toggle("rtl-preview", isRtlLanguage());
  document.documentElement.lang = activeLanguage;
  document.documentElement.dir = isRtlLanguage() ? "rtl" : "ltr";
  document.getElementById("languageStatus").textContent = `Language: ${languageLabels[activeLanguage] || "English"}`;
}

function syncReportTotals() {
  document.getElementById("reportSales").textContent = money(salesTotal);
  document.getElementById("reportCash").textContent = money(expectedCash);
}

function syncDashboardTotals() {
  document.getElementById("todaySales").textContent = money(Math.round(salesTotal));
  document.getElementById("expectedCash").textContent = money(Math.round(expectedCash));
}

function purchaseTotal(purchase) {
  return Math.max((Number(purchase.qty) || 0) * (Number(purchase.unitCost) || 0) - (Number(purchase.discount) || 0), 0);
}

function totalPurchases() {
  return purchases.reduce((sum, purchase) => sum + purchaseTotal(purchase), 0);
}

function totalExpenses() {
  return expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
}

function cashOutTotal(records) {
  return records.reduce((sum, record) => record.payment === "Cash" ? sum + (purchaseTotal(record) || Number(record.amount) || 0) : sum, 0);
}

function syncSummaryTotals() {
  document.querySelector(".metric-card:nth-child(3) strong").textContent = money(Math.round(totalPurchases()));
  document.querySelector(".metric-card:nth-child(4) strong").textContent = money(Math.round(totalExpenses()));
  document.querySelector(".statement-grid div:nth-child(3) strong").textContent = money(Math.round(totalPurchases()));
  document.querySelector(".statement-grid div:nth-child(4) strong").textContent = money(Math.round(totalExpenses()));
  syncDashboardTotals();
  syncReportTotals();
}

function moneyFixed(amount) {
  return `AED ${amount.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function updatePurchaseCalculation() {
  const qty = Number(document.getElementById("purchaseQty").value || 0);
  const unit = document.getElementById("purchaseUnit").value.trim() || "unit";
  const unitCost = Number(document.getElementById("purchaseUnitCost").value || 0);
  const discount = Number(document.getElementById("purchaseDiscount").value || 0);
  const subtotal = qty * unitCost;
  const total = Math.max(subtotal - discount, 0);

  document.getElementById("calcQty").textContent = `${qty.toLocaleString("en-AE")} ${unit}`;
  document.getElementById("calcUnitCost").textContent = moneyFixed(unitCost);
  document.getElementById("calcSubtotal").textContent = moneyFixed(subtotal);
  document.getElementById("calcPurchaseTotal").textContent = moneyFixed(total);
}

function renderSaleServices() {
  const container = document.getElementById("saleServices");
  container.innerHTML = "";
  services
    .filter((service) => service.active)
    .forEach((service) => {
      const button = document.createElement("button");
      button.className = `service-tile ${service.name === selectedService.name ? "active" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <strong class="${isRtlLanguage() ? "rtl-preview" : ""}">${serviceName(service)}</strong>
        <small>${service.recipe}</small>
        <span>${money(service.price)}</span>
      `;
      button.addEventListener("click", () => {
        selectedService = service;
        syncSelectedServiceLabel();
        renderSaleServices();
      });
      container.appendChild(button);
    });
}

function renderServiceTable() {
  const body = document.getElementById("serviceTable");
  body.innerHTML = "";
  services.forEach((service, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${service.name}</strong></td>
      <td class="${isRtlLanguage() ? "rtl-preview" : ""}">${serviceName(service)}</td>
      <td>${service.category}</td>
      <td>${money(service.price)}</td>
      <td>${service.recipe}</td>
      <td>${service.active ? "Active" : "Inactive"}</td>
      <td><button class="danger-button" data-delete-service="${index}" type="button">Delete</button></td>
    `;
    row.addEventListener("click", () => {
      document.getElementById("serviceName").value = service.name;
      document.getElementById("serviceNameAr").value = service.names?.ar || "";
      document.getElementById("serviceNameHi").value = service.names?.hi || "";
      document.getElementById("serviceNameUr").value = service.names?.ur || "";
      document.getElementById("serviceCategory").value = service.category;
      document.getElementById("servicePrice").value = service.price;
      document.getElementById("serviceRecipe").value = service.recipe;
      document.getElementById("serviceFormTitle").textContent = `Edit ${service.name}`;
    });
    body.appendChild(row);
  });

  body.querySelectorAll("[data-delete-service]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = Number(button.dataset.deleteService);
      services.splice(index, 1);
      selectedService = services[0] || { name: "No service", price: 0, active: false };
      saveState();
      renderServiceTable();
      renderSaleServices();
      syncSelectedServiceLabel();
    });
  });
}

function renderPurchaseTable() {
  const body = document.getElementById("purchaseTable");
  body.innerHTML = "";
  purchases.forEach((purchase, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${purchase.supplier}</td>
      <td>${purchase.item}<br><small>${purchase.qty} ${purchase.unit} × ${moneyFixed(purchase.unitCost)}</small></td>
      <td>${purchase.payment || "Cash"}</td>
      <td>${moneyFixed(purchaseTotal(purchase))}</td>
      <td><button class="danger-button" data-delete-purchase="${index}" type="button">Delete</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-delete-purchase]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.deletePurchase);
      const purchase = purchases[index];
      if (purchase?.payment === "Cash") {
        expectedCash += purchaseTotal(purchase);
      }
      purchases.splice(index, 1);
      saveState();
      renderPurchaseTable();
      syncSummaryTotals();
      document.getElementById("purchaseNote").textContent = "Purchase deleted. Totals were recalculated.";
    });
  });
}

function renderExpenseTable() {
  const body = document.getElementById("expenseTable");
  body.innerHTML = "";
  expenses.forEach((expense, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${expense.category}</td>
      <td>${expense.note || "-"}</td>
      <td>${expense.payment}</td>
      <td>${moneyFixed(Number(expense.amount) || 0)}</td>
      <td><button class="danger-button" data-delete-expense="${index}" type="button">Delete</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-delete-expense]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.deleteExpense);
      const expense = expenses[index];
      if (expense?.payment === "Cash") {
        expectedCash += Number(expense.amount) || 0;
      }
      expenses.splice(index, 1);
      saveState();
      renderExpenseTable();
      syncSummaryTotals();
      document.getElementById("expenseNote").textContent = "Expense deleted. Totals were recalculated.";
    });
  });
}

document.getElementById("saveSale").addEventListener("click", () => {
  salesTotal += selectedService.price;
  if (document.getElementById("paymentMethod").value === "Cash") {
    expectedCash += selectedService.price;
  }
  document.getElementById("todaySales").textContent = money(salesTotal);
  document.getElementById("expectedCash").textContent = money(expectedCash);
  saveState();
  syncReportTotals();
  const taxText = vatEnabled ? "VAT invoice fields are active." : "No VAT was added.";
  document.getElementById("saleNote").textContent = `${selectedService.name} saved. Cash, staff performance and stock recipe were updated. ${taxText}`;
});

document.getElementById("saveService").addEventListener("click", () => {
  const name = document.getElementById("serviceName").value.trim();
  const names = {
    ar: document.getElementById("serviceNameAr").value.trim(),
    hi: document.getElementById("serviceNameHi").value.trim(),
    ur: document.getElementById("serviceNameUr").value.trim()
  };
  const category = document.getElementById("serviceCategory").value;
  const price = Number(document.getElementById("servicePrice").value || 0);
  const recipe = document.getElementById("serviceRecipe").value.trim();
  const existing = services.find((service) => service.name.toLowerCase() === name.toLowerCase());

  if (existing) {
    existing.category = category;
    existing.price = price;
    existing.recipe = recipe;
    existing.names = names;
  } else if (name) {
    services.push({ name, names, category, price, recipe, active: true });
  }

  selectedService = services.find((service) => service.name === name) || selectedService;
  renderServiceTable();
  renderSaleServices();
  saveState();
  syncSelectedServiceLabel();
});

document.getElementById("addServiceBtn").addEventListener("click", () => {
  document.getElementById("serviceFormTitle").textContent = "Add New Service";
  document.getElementById("serviceName").value = "Custom Service";
  document.getElementById("serviceNameAr").value = "";
  document.getElementById("serviceNameHi").value = "";
  document.getElementById("serviceNameUr").value = "";
  document.getElementById("serviceCategory").value = "Custom";
  document.getElementById("servicePrice").value = "30";
  document.getElementById("serviceRecipe").value = "No stock recipe";
});

document.querySelectorAll(".language-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    activeLanguage = button.textContent.trim().toLowerCase();
    syncLanguageButtons();
    renderSaleServices();
    renderServiceTable();
    syncSelectedServiceLabel();
    saveState();
  });
});

document.getElementById("toggleReceipt").addEventListener("click", () => {
  receiptEnabled = !receiptEnabled;
  syncTaxSettings();
});

document.getElementById("toggleVat").addEventListener("click", () => {
  vatEnabled = !vatEnabled;
  syncTaxSettings();
});

document.getElementById("vatModeSelect").addEventListener("change", (event) => {
  vatEnabled = event.target.value === "on";
  syncTaxSettings();
});

document.getElementById("receiptModeSelect").addEventListener("change", (event) => {
  receiptEnabled = event.target.value !== "off";
  syncTaxSettings();
});

document.getElementById("saveSettings").addEventListener("click", () => {
  document.getElementById("settingsTaxPill").textContent = vatEnabled
    ? "VAT on"
    : "VAT optional";
  saveState();
});

document.getElementById("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const role = document.getElementById("loginRole").value;
  window.scrollTo({ top: 0, left: 0 });
  document.body.classList.add("is-authenticated");
  document.getElementById("frontpage").classList.add("front-hidden");
  document.getElementById("appShell").classList.remove("app-hidden");
  document.getElementById("userChip").textContent = `${role} · Al Barsha`;
  showView(role === "Staff" ? "quick-sale" : "dashboard");
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  window.scrollTo({ top: 0, left: 0 });
  document.body.classList.remove("is-authenticated");
  document.getElementById("appShell").classList.add("app-hidden");
  document.getElementById("frontpage").classList.remove("front-hidden");
});

document.getElementById("printReport").addEventListener("click", () => {
  showView("reports");
  window.print();
});

document.getElementById("savePurchase").addEventListener("click", () => {
  const purchase = {
    supplier: document.getElementById("purchaseSupplier").value.trim() || "Unknown supplier",
    type: document.getElementById("purchaseType").value,
    item: document.getElementById("purchaseItem").value.trim() || "Unnamed item",
    qty: Number(document.getElementById("purchaseQty").value || 0),
    unit: document.getElementById("purchaseUnit").value.trim() || "unit",
    unitCost: Number(document.getElementById("purchaseUnitCost").value || 0),
    discount: Number(document.getElementById("purchaseDiscount").value || 0),
    payment: document.getElementById("purchasePayment").value
  };

  purchases.push(purchase);
  if (purchase.payment === "Cash") {
    expectedCash -= purchaseTotal(purchase);
    document.getElementById("expectedCash").textContent = money(Math.round(expectedCash));
  }
  saveState();
  renderPurchaseTable();
  syncSummaryTotals();
  document.getElementById("purchaseNote").textContent = `${purchase.item} saved. ${purchase.qty} ${purchase.unit} × ${moneyFixed(purchase.unitCost)} = ${moneyFixed(purchaseTotal(purchase))}.`;
});

document.getElementById("saveExpense").addEventListener("click", () => {
  const expense = {
    category: document.getElementById("expenseCategory").value,
    amount: Number(document.getElementById("expenseAmount").value || 0),
    payment: document.getElementById("expensePayment").value,
    note: document.getElementById("expenseNoteInput").value.trim()
  };

  expenses.push(expense);
  if (expense.payment === "Cash") {
    expectedCash -= expense.amount;
    document.getElementById("expectedCash").textContent = money(Math.round(expectedCash));
  }
  saveState();
  renderExpenseTable();
  syncSummaryTotals();
  document.getElementById("expenseNote").textContent = `${expense.category} expense saved for ${moneyFixed(expense.amount)}.`;
});

["purchaseQty", "purchaseUnit", "purchaseUnitCost", "purchaseDiscount"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updatePurchaseCalculation);
});

function syncTaxSettings() {
  const taxMode = vatEnabled ? "VAT On" : "VAT Off";
  const branchLabel = vatEnabled ? "VAT enabled · tax invoice mode" : "VAT optional · currently off";
  const checkoutNote = vatEnabled ? "VAT on: tax invoice mode" : "VAT off: internal sale record only";
  const receiptText = receiptEnabled ? "Receipt on" : "Receipt off";

  document.body.classList.toggle("vat-enabled", vatEnabled);
  document.getElementById("taxModeLabel").textContent = taxMode;
  document.getElementById("branchTaxLabel").textContent = branchLabel;
  document.getElementById("topTaxLabel").textContent = `Monday, 31 Aug · AED · ${taxMode}`;
  document.getElementById("toggleVat").textContent = vatEnabled ? "Turn VAT off" : "Turn VAT on";
  document.getElementById("toggleReceipt").textContent = receiptText;
  document.getElementById("checkoutTaxNote").textContent = checkoutNote;
  document.getElementById("checkoutTaxMode").textContent = taxMode;
  document.getElementById("checkoutReceiptMode").textContent = receiptEnabled ? "Optional On" : "Optional Off";
  document.getElementById("salesCardLabel").textContent = vatEnabled ? "Sales incl. VAT" : "Sales";
  document.getElementById("salesCardNote").textContent = vatEnabled
    ? "64 services · VAT calculated separately"
    : "64 services · 7 retail items · no VAT added";
  document.getElementById("vatModeSelect").value = vatEnabled ? "on" : "off";
  document.getElementById("receiptModeSelect").value = receiptEnabled ? "simple" : "off";
  document.getElementById("settingsTaxPill").textContent = vatEnabled ? "VAT on" : "VAT optional";
  saveState();
}

migrateServices();
saveState();
renderSaleServices();
renderServiceTable();
renderPurchaseTable();
renderExpenseTable();
syncLanguageButtons();
syncSelectedServiceLabel();
syncTaxSettings();
syncReportTotals();
syncSummaryTotals();
updatePurchaseCalculation();
