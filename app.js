const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3z"/><path d="M13 21h8V3h-8z"/><path d="M3 21h8v-6H3z"/></svg>',
  setup: '<svg viewBox="0 0 24 24"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h10"/><path d="m15 18 2 2 4-4"/></svg>',
  sale: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  services: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>',
  purchase: '<svg viewBox="0 0 24 24"><path d="M6 2v4"/><path d="M18 2v4"/><path d="M3 6h18v16H3z"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>',
  expense: '<svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
  stock: '<svg viewBox="0 0 24 24"><path d="M21 8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2Z"/><path d="M7 8v8"/><path d="M17 8v8"/></svg>',
  compliance: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m8.5 12 2.3 2.3 4.7-5"/></svg>',
  cash: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01"/><path d="M18 14h.01"/></svg>',
  report: '<svg viewBox="0 0 24 24"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 14h2v3H7z"/><path d="M12 10h2v7h-2z"/><path d="M17 7h2v10h-2z"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 0 1 4 0v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.56.6 1 .6h.6a2 2 0 0 1 0 4h-.6a1.7 1.7 0 0 0-1 .6Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>'
};

const storageKey = "salon-control-mvp";
let memoryState = null;
const platformAccount = {
  shopCode: "PLATFORM",
  username: "admin",
  password: "9999",
  role: "Platform Admin",
  name: "Platform Admin"
};

const countryProfiles = {
  AE: { name: "United Arab Emirates", currency: "AED", locale: "en-AE", decimals: 2, taxLabel: "VAT", tenancyName: "Ejari / tenancy contract", healthName: "Occupational health card" },
  QA: { name: "Qatar", currency: "QAR", locale: "en-QA", decimals: 2, taxLabel: "VAT", tenancyName: "Lease contract", healthName: "Health certificate" },
  SA: { name: "Saudi Arabia", currency: "SAR", locale: "en-SA", decimals: 2, taxLabel: "VAT", tenancyName: "Lease / deed proof", healthName: "Balady health certificate" },
  KW: { name: "Kuwait", currency: "KWD", locale: "en-KW", decimals: 3, taxLabel: "VAT", tenancyName: "Lease contract", healthName: "Worker health fitness record" },
  BH: { name: "Bahrain", currency: "BHD", locale: "en-BH", decimals: 3, taxLabel: "VAT", tenancyName: "Lease contract / address card", healthName: "MOH health certificate" },
  OM: { name: "Oman", currency: "OMR", locale: "en-OM", decimals: 3, taxLabel: "VAT", tenancyName: "Municipal lease / location approval", healthName: "Annual medical fitness" }
};

const currencyToCountry = Object.fromEntries(
  Object.entries(countryProfiles).map(([country, profile]) => [profile.currency, country])
);

const baseExpiryTypes = [
  "Trade licence",
  "Municipality licence",
  "Civil defence / safety certificate",
  "Pest control certificate",
  "Staff visa / residence permit",
  "Staff ID card",
  "Staff vaccination record",
  "Product registration / cosmetics approval",
  "Insurance policy",
  "WPS / payroll file"
];

const rolePins = {
  "Platform Admin": "9999",
  "Shop Admin": "9999",
  Owner: "1234",
  Cashier: "2222",
  Staff: "1111"
};

const roleAccess = {
  "Platform Admin": ["master-admin", "dashboard", "setup", "quick-sale", "clients", "services", "purchases", "expenses", "inventory", "compliance", "cash", "accounting", "reports", "settings"],
  "Shop Admin": ["dashboard", "setup", "quick-sale", "clients", "services", "purchases", "expenses", "inventory", "compliance", "cash", "accounting", "reports", "settings"],
  Owner: ["dashboard", "setup", "quick-sale", "clients", "services", "purchases", "expenses", "inventory", "compliance", "cash", "accounting", "reports", "settings"],
  Cashier: ["dashboard", "quick-sale", "purchases", "expenses", "inventory", "cash", "reports"],
  Staff: ["quick-sale", "services"]
};

const viewLabels = {
  "master-admin": "Super Admin",
  dashboard: "Dashboard",
  setup: "Setup",
  "quick-sale": "Quick Sale",
  clients: "Clients & Queue",
  services: "Services",
  purchases: "Purchases",
  expenses: "Expenses",
  inventory: "Inventory & Tools",
  compliance: "Compliance",
  cash: "Cash Closing",
  accounting: "Accounting",
  reports: "Reports",
  "launch-audit": "Launch Audit",
  settings: "Settings"
};

const chartOfAccounts = [
  { code: "1000", name: "Cash on hand", type: "Asset" },
  { code: "1010", name: "Bank / card clearing", type: "Asset" },
  { code: "1200", name: "Inventory and supplies", type: "Asset" },
  { code: "1500", name: "Reusable tools and equipment", type: "Asset" },
  { code: "2000", name: "Supplier payable", type: "Liability" },
  { code: "2100", name: "VAT payable", type: "Liability" },
  { code: "4000", name: "Service revenue", type: "Income" },
  { code: "5000", name: "Consumable purchases", type: "Cost" },
  { code: "6100", name: "Shop operating expenses", type: "Expense" },
  { code: "6200", name: "Cash shortage / overage", type: "Expense" },
  { code: "7000", name: "Staff commission payable", type: "Liability" }
];

const launchAuditItems = [
  { id: "marketing", area: "Front Door", title: "Marketing site and premium login", priority: "P1", launchRequired: true, marketReason: "A new shop must understand the offer before login.", test: () => !!document.getElementById("frontpage") && !!document.getElementById("loginForm"), next: "Keep brand, app and login design consistent." },
  { id: "roles", area: "Access", title: "Role-based navigation", priority: "P0", launchRequired: true, marketReason: "Owner, cashier and staff must only see their own tools.", test: () => currentRole === "Platform Admin" || !roleAccess[currentRole]?.includes("master-admin"), next: "Move permissions to backend and add per-action rules." },
  { id: "shops", area: "Platform Admin", title: "Create, suspend, restore and delete shops", priority: "P0", launchRequired: true, marketReason: "The platform admin must provision every branch and hand over credentials.", test: () => shops.length > 0 && !!document.getElementById("createShopBtn") && !!document.getElementById("masterShopTable"), next: "Persist shops on server with tenant isolation." },
  { id: "sales", area: "POS", title: "Quick sale with multiple services", priority: "P0", launchRequired: true, marketReason: "Barber checkout must handle haircut plus beard plus facial in one ticket.", test: () => services.filter((service) => service.active).length >= 5 && !!document.getElementById("saleServices"), next: "Add customer, discount, tip and refund controls." },
  { id: "purchases", area: "Purchasing", title: "Purchases with qty, unit cost and total", priority: "P0", launchRequired: true, marketReason: "Supplier bills must update stock and cash/bank outflow.", test: () => !!document.getElementById("purchaseQty") && !!document.getElementById("purchaseUnitCost") && !!document.getElementById("calcPurchaseTotal"), next: "Add suppliers, invoice files, payables and receiving workflow." },
  { id: "expenses", area: "Expenses", title: "Cash expenses and shop running costs", priority: "P0", launchRequired: true, marketReason: "Tea, food, laundry, cleaning and repair must affect cash closing.", test: () => !!document.getElementById("expenseCategory") && !!document.getElementById("saveExpense"), next: "Add recurring expenses, approvals and receipt uploads." },
  { id: "inventory", area: "Stock", title: "Consumables and reusable tools", priority: "P0", launchRequired: true, marketReason: "Blades, foam, oil, color and tools must be controlled separately.", test: () => !!document.getElementById("stockList") || !!document.getElementById("inventory"), next: "Add stock counts, batches, expiry, transfers and tool maintenance." },
  { id: "compliance", area: "Compliance", title: "Expiry register and photo/PDF evidence", priority: "P0", launchRequired: true, marketReason: "Lease, visa, pest control and health files need reminders and proof.", test: () => !!document.getElementById("expiryEvidenceFile") && !!document.getElementById("hygieneEvidenceFile"), next: "Store files in cloud storage and add renewal workflow." },
  { id: "country", area: "GCC", title: "Country profile, currency and VAT mode", priority: "P0", launchRequired: true, marketReason: "UAE, Qatar, Saudi, Kuwait, Bahrain and Oman need different currency and tax defaults.", test: () => !!countryProfiles.AE && !!countryProfiles.QA && !!countryProfiles.SA && !!document.getElementById("countrySelect"), next: "Add official rule packs and per-country compliance templates." },
  { id: "reports", area: "Reporting", title: "Daily close and owner reports", priority: "P0", launchRequired: true, marketReason: "Owners need cash, purchases, expenses, commission and shortage output.", test: () => !!document.getElementById("reportOutputTable") && !!document.getElementById("approveClosing"), next: "Add accountant exports and immutable close periods." },
  { id: "accounting", area: "Accounting", title: "Real accounting ledger", priority: "P0", launchRequired: true, marketReason: "A market product cannot rely on dashboard totals only.", test: () => !!document.querySelector("#accountingJournalTable tr") && !!document.querySelector("#accountingTrialTable tr"), next: "Move journals to backend storage, add supplier balances and locked accounting periods." },
  { id: "backend", area: "Backend", title: "Database, APIs and cloud persistence", priority: "P0", launchRequired: true, marketReason: "Active users need data available across devices and protected from browser clearing.", test: () => false, next: "Add Supabase/Firebase/Postgres backend with migrations and APIs." },
  { id: "files", area: "Storage", title: "Production file storage and backups", priority: "P0", launchRequired: true, marketReason: "PDFs and images must be backed up, previewable and recoverable.", test: () => false, next: "Add object storage, malware checks, size limits, retention and restore." },
  { id: "security", area: "Security", title: "Secure auth, password reset and audit logs", priority: "P0", launchRequired: true, marketReason: "Demo passwords are not acceptable for paying users.", test: () => false, next: "Hash passwords, add sessions, MFA option, lockout and login history." },
  { id: "customers", area: "CRM", title: "Customers, appointments and walk-in queue", priority: "P1", launchRequired: true, marketReason: "Professional salon systems include booking, queue, customer history and reminders.", test: () => !!document.getElementById("customerTable") && !!document.getElementById("queueTable") && customers.length > 0, next: "Add online booking links, SMS/WhatsApp reminders and deposit redemption." },
  { id: "payroll", area: "Staff", title: "Attendance, salary, commission and WPS", priority: "P1", launchRequired: true, marketReason: "Owners need accurate barber payout and payroll control.", test: () => Array.isArray(staffPayments) && staffPayments.length > 0, next: "Add attendance, leave, advances, deductions and commission rules." },
  { id: "exports", area: "Data Output", title: "CSV, PDF and accounting export", priority: "P1", launchRequired: true, marketReason: "A real shop must send data to owner, accountant and auditor.", test: () => typeof downloadDataExport === "function" && !!document.querySelector('[data-export="backup"]'), next: "Add scheduled monthly packs and backend-stored export history." },
  { id: "qa", area: "QA", title: "Desktop and mobile browser QA", priority: "P0", launchRequired: true, marketReason: "No buttons should disappear and every save path must be tested before handoff.", test: () => window.innerWidth > 0 && !!document.getElementById("mobileViewSwitcher"), next: "Add automated browser smoke tests for each role and viewport." }
];

const productionRequirements = [
  ["Backend", "Database tables for shops, users, roles, sales, purchases, expenses, stock, documents and files."],
  ["Accounting", "Chart of accounts, journals, ledgers, closing periods, supplier balances and owner drawings."],
  ["Security", "Hashed passwords, sessions, password reset, lockout, audit history and tenant isolation."],
  ["Backups", "Daily backups, point-in-time restore, export pack and file retention policy."],
  ["Compliance", "Country rule packs for GCC currencies, VAT defaults, licences, health cards and renewals."],
  ["Operations", "Customers, appointments, walk-in queue, staff attendance, payroll and commission workflow."]
];

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

const uiTranslations = {
  "Barber shop mode": { ar: "وضع صالون الحلاقة", hi: "बारबर शॉप मोड", ur: "حجام کی دکان موڈ" },
  "Active branch": { ar: "الفرع النشط", hi: "सक्रिय शाखा", ur: "فعال برانچ" },
  "VAT optional · currently off": { ar: "ضريبة القيمة المضافة اختيارية · متوقفة حالياً", hi: "VAT वैकल्पिक · अभी बंद", ur: "VAT اختیاری · فی الحال بند" },
  Dashboard: { ar: "لوحة التحكم", hi: "डैशबोर्ड", ur: "ڈیش بورڈ" },
  Setup: { ar: "الإعداد", hi: "सेटअप", ur: "سیٹ اپ" },
  "Quick Sale": { ar: "بيع سريع", hi: "त्वरित बिक्री", ur: "فوری فروخت" },
  All: { ar: "الكل", hi: "सभी", ur: "سب" },
  Services: { ar: "الخدمات", hi: "सेवाएं", ur: "خدمات" },
  Purchases: { ar: "المشتريات", hi: "खरीदारी", ur: "خریداری" },
  Expenses: { ar: "المصروفات", hi: "खर्चे", ur: "اخراجات" },
  "Inventory & Tools": { ar: "المخزون والأدوات", hi: "इन्वेंटरी और टूल्स", ur: "اسٹاک اور اوزار" },
  Inventory: { ar: "المخزون", hi: "इन्वेंटरी", ur: "اسٹاک" },
  Compliance: { ar: "الامتثال", hi: "अनुपालन", ur: "تعمیل" },
  "Compliance Control": { ar: "تحكم الامتثال", hi: "अनुपालन कंट्रोल", ur: "تعمیل کنٹرول" },
  "Inspection readiness": { ar: "جاهزية التفتيش", hi: "निरीक्षण तैयारी", ur: "معائنہ تیاری" },
  "Open hygiene, document and product checks": { ar: "فحوصات النظافة والوثائق والمنتجات المفتوحة", hi: "खुले हाइजीन, दस्तावेज और उत्पाद चेक", ur: "کھلے صفائی، دستاویز اور مصنوعات چیک" },
  "Overdue records": { ar: "السجلات المتأخرة", hi: "ओवरड्यू रिकॉर्ड", ur: "اوور ڈیو ریکارڈ" },
  "Amber and red items need owner action": { ar: "العناصر الصفراء والحمراء تحتاج إجراء المالك", hi: "एम्बर और रेड आइटम पर मालिक कार्रवाई चाहिए", ur: "ایمبر اور ریڈ آئٹمز پر مالک عمل چاہیے" },
  "WPS status": { ar: "حالة نظام حماية الأجور", hi: "WPS स्थिति", ur: "WPS حالت" },
  "Day 2": { ar: "اليوم 2", hi: "दिन 2", ur: "دن 2" },
  "Salary transfer countdown": { ar: "عد تنازلي لتحويل الراتب", hi: "सैलरी ट्रांसफर काउंटडाउन", ur: "تنخواہ ٹرانسفر کاؤنٹ ڈاؤن" },
  "Montaji watch": { ar: "متابعة منتجي", hi: "Montaji निगरानी", ur: "منتجی نگرانی" },
  "Product registration warning": { ar: "تحذير تسجيل المنتج", hi: "उत्पाद पंजीकरण चेतावनी", ur: "مصنوعات رجسٹریشن وارننگ" },
  "Inspection Binder": { ar: "ملف التفتيش", hi: "निरीक्षण बाइंडर", ur: "معائنہ بائنڈر" },
  "Dubai Municipality records, due dates, signer and evidence slot": { ar: "سجلات بلدية دبي وتواريخ الاستحقاق والموقع وخانة الإثبات", hi: "दुबई नगरपालिका रिकॉर्ड, देय तारीख, हस्ताक्षर और प्रमाण स्लॉट", ur: "دبئی میونسپلٹی ریکارڈ، due dates، signer اور evidence slot" },
  "Complete round": { ar: "إكمال الجولة", hi: "राउंड पूरा करें", ur: "راؤنڈ مکمل کریں" },
  "Evidence required": { ar: "الإثبات مطلوب", hi: "प्रमाण आवश्यक", ur: "ثبوت ضروری" },
  "Evidence is required before an inspection record can be signed.": { ar: "الإثبات مطلوب قبل توقيع سجل التفتيش.", hi: "निरीक्षण रिकॉर्ड पर हस्ताक्षर से पहले प्रमाण जरूरी है।", ur: "معائنہ ریکارڈ پر دستخط سے پہلے ثبوت ضروری ہے۔" },
  "Evidence required before signing.": { ar: "الإثبات مطلوب قبل التوقيع.", hi: "हस्ताक्षर से पहले प्रमाण जरूरी है।", ur: "دستخط سے پہلے ثبوت ضروری ہے۔" },
  "Inspection signed with evidence.": { ar: "تم توقيع التفتيش مع الإثبات.", hi: "निरीक्षण प्रमाण के साथ हस्ताक्षरित हुआ।", ur: "معائنہ ثبوت کے ساتھ دستخط ہوا۔" },
  Record: { ar: "السجل", hi: "रिकॉर्ड", ur: "ریکارڈ" },
  Cadence: { ar: "التكرار", hi: "आवृत्ति", ur: "وقفہ" },
  Due: { ar: "الاستحقاق", hi: "देय", ur: "واجب" },
  "Signed by": { ar: "وقع بواسطة", hi: "हस्ताक्षर", ur: "دستخط کنندہ" },
  Evidence: { ar: "الإثبات", hi: "प्रमाण", ur: "ثبوت" },
  "Expiry Graph": { ar: "رسم انتهاء الصلاحية", hi: "एक्सपायरी ग्राफ", ur: "ایکسپائری گراف" },
  "Dependencies that can block renewals and visas": { ar: "اعتماديات قد توقف التجديدات والتأشيرات", hi: "निर्भरता जो रिन्यूअल और वीजा रोक सकती है", ur: "انحصار جو renewals اور visas روک سکتے ہیں" },
  "Sterilization & Hygiene Log": { ar: "سجل التعقيم والنظافة", hi: "स्टरलाइजेशन और हाइजीन लॉग", ur: "جراثیم کشی اور صفائی لاگ" },
  "Device, operator, cycle, towels, apron and blade checks": { ar: "فحص الجهاز والمشغل والدورة والمناشف والمريلة والشفرات", hi: "डिवाइस, ऑपरेटर, साइकिल, तौलिए, एप्रन और ब्लेड चेक", ur: "ڈیوائس، آپریٹر، سائیکل، تولیے، ایپرن اور بلیڈ چیک" },
  "Add hygiene log": { ar: "إضافة سجل نظافة", hi: "हाइजीन लॉग जोड़ें", ur: "صفائی لاگ شامل کریں" },
  Time: { ar: "الوقت", hi: "समय", ur: "وقت" },
  Device: { ar: "الجهاز", hi: "डिवाइस", ur: "ڈیوائس" },
  Operator: { ar: "المشغل", hi: "ऑपरेटर", ur: "آپریٹر" },
  Cycle: { ar: "الدورة", hi: "साइकिल", ur: "سائیکل" },
  Solution: { ar: "المحلول", hi: "सॉल्यूशन", ur: "سلوشن" },
  "Single-use check": { ar: "فحص الاستخدام الواحد", hi: "सिंगल-यूज चेक", ur: "سنگل یوز چیک" },
  "Every hygiene entry needs a real cycle and evidence note.": { ar: "كل إدخال نظافة يحتاج دورة فعلية وملاحظة إثبات.", hi: "हर हाइजीन एंट्री में असली साइकिल और प्रमाण नोट चाहिए।", ur: "ہر صفائی اندراج میں اصل سائیکل اور ثبوت نوٹ چاہیے۔" },
  "Enter device, cycle and evidence before saving.": { ar: "أدخل الجهاز والدورة والإثبات قبل الحفظ.", hi: "सेव करने से पहले डिवाइस, साइकिल और प्रमाण भरें।", ur: "محفوظ کرنے سے پہلے ڈیوائس، سائیکل اور ثبوت درج کریں۔" },
  "Hygiene log saved with evidence.": { ar: "تم حفظ سجل النظافة مع الإثبات.", hi: "हाइजीन लॉग प्रमाण के साथ सेव हुआ।", ur: "صفائی لاگ ثبوت کے ساتھ محفوظ ہوا۔" },
  "WPS & Product Watch": { ar: "متابعة الأجور والمنتجات", hi: "WPS और उत्पाद निगरानी", ur: "WPS اور مصنوعات نگرانی" },
  "Salary deadline and cosmetic registration controls": { ar: "مهلة الراتب وضوابط تسجيل مستحضرات التجميل", hi: "सैलरी डेडलाइन और कॉस्मेटिक पंजीकरण नियंत्रण", ur: "تنخواہ deadline اور cosmetic registration controls" },
  "Salary file": { ar: "ملف الرواتب", hi: "सैलरी फ़ाइल", ur: "تنخواہ فائل" },
  "WPS below 85%": { ar: "نظام الأجور أقل من 85%", hi: "WPS 85% से कम", ur: "WPS 85% سے کم" },
  "WPS on track": { ar: "نظام الأجور على المسار", hi: "WPS सही चल रहा है", ur: "WPS درست ہے" },
  "Due in 3 days · 5 of 6 staff paid": { ar: "مستحق خلال 3 أيام · دفع 5 من 6 موظفين", hi: "3 दिन में देय · 6 में से 5 स्टाफ paid", ur: "3 دن میں واجب · 6 میں سے 5 اسٹاف ادا" },
  "Target: meet 85% paid staff before Day 5": { ar: "الهدف: تحقيق 85% موظفين مدفوعين قبل اليوم الخامس", hi: "लक्ष्य: Day 5 से पहले 85% paid staff", ur: "ہدف: Day 5 سے پہلے 85% paid staff" },
  SKU: { ar: "رمز المنتج", hi: "SKU", ur: "SKU" },
  Ready: { ar: "جاهز", hi: "तैयार", ur: "تیار" },
  DueSoon: { ar: "قريب الاستحقاق", hi: "जल्द देय", ur: "جلد واجب" },
  Overdue: { ar: "متأخر", hi: "ओवरड्यू", ur: "اوور ڈیو" },
  Unknown: { ar: "غير معروف", hi: "अज्ञात", ur: "نامعلوم" },
  Registered: { ar: "مسجل", hi: "पंजीकृत", ur: "رجسٹرڈ" },
  "Needs ref": { ar: "يحتاج رقم مرجعي", hi: "रेफरेंस चाहिए", ur: "ریفرنس چاہیے" },
  Signed: { ar: "تم التوقيع", hi: "हस्ताक्षर हुआ", ur: "دستخط ہو گیا" },
  "Mark signed": { ar: "تسجيل التوقيع", hi: "हस्ताक्षर मार्क करें", ur: "دستخط مارک کریں" },
  Today: { ar: "اليوم", hi: "आज", ur: "آج" },
  Tomorrow: { ar: "غداً", hi: "कल", ur: "کل" },
  Pending: { ar: "معلق", hi: "लंबित", ur: "زیر التوا" },
  "Checklist photo": { ar: "صورة القائمة", hi: "चेकलिस्ट फोटो", ur: "چیک لسٹ تصویر" },
  "Cycle log": { ar: "سجل الدورة", hi: "साइकिल लॉग", ur: "سائیکل لاگ" },
  "PDF missing": { ar: "PDF مفقود", hi: "PDF गायब", ur: "PDF غائب" },
  "Card copies": { ar: "نسخ البطاقات", hi: "कार्ड कॉपी", ur: "کارڈ کاپیاں" },
  "10 min heat cycle": { ar: "دورة حرارة 10 دقائق", hi: "10 मिनट हीट साइकिल", ur: "10 منٹ ہیٹ سائیکل" },
  "Fresh blade pack opened": { ar: "تم فتح عبوة شفرات جديدة", hi: "नया ब्लेड पैक खोला गया", ur: "نیا بلیڈ پیک کھولا گیا" },
  "Surface wipe + towel change": { ar: "مسح السطح + تغيير المنشفة", hi: "सतह वाइप + तौलिया बदला", ur: "سطح صاف + تولیہ تبدیل" },
  "Cape and neck strip replaced": { ar: "تم تغيير الغطاء وشريط الرقبة", hi: "केप और नेक स्ट्रिप बदले गए", ur: "کیپ اور نیک اسٹرپ تبدیل" },
  "44 blades counted": { ar: "تم عد 44 شفرة", hi: "44 ब्लेड गिने गए", ur: "44 بلیڈ گنے گئے" },
  "38 shaves recorded": { ar: "تم تسجيل 38 حلاقة", hi: "38 शेव दर्ज", ur: "38 شیو درج" },
  "Fresh cycle logged": { ar: "تم تسجيل دورة جديدة", hi: "नई साइकिल लॉग हुई", ur: "نیا سائیکل لاگ ہوا" },
  "Blade and towel check completed": { ar: "اكتمل فحص الشفرات والمناشف", hi: "ब्लेड और तौलिया चेक पूरा", ur: "بلیڈ اور تولیہ چیک مکمل" },
  "Trade licence": { ar: "رخصة تجارية", hi: "ट्रेड लाइसेंस", ur: "ٹریڈ لائسنس" },
  "Establishment card": { ar: "بطاقة المنشأة", hi: "एस्टैब्लिशमेंट कार्ड", ur: "اسٹیبلشمنٹ کارڈ" },
  "Visas / EID / health cards": { ar: "التأشيرات / الهوية / البطاقات الصحية", hi: "वीजा / EID / हेल्थ कार्ड", ur: "ویزے / EID / صحت کارڈ" },
  "Upload supplier proof": { ar: "ارفع إثبات المورد", hi: "सप्लायर प्रमाण अपलोड", ur: "سپلائر ثبوت اپ لوڈ" },
  "Do not reorder until checked": { ar: "لا تعد الطلب قبل الفحص", hi: "जांच तक रीऑर्डर न करें", ur: "چیک تک ری آرڈر نہ کریں" },
  "Cleaning & sanitization": { ar: "التنظيف والتعقيم", hi: "सफाई और सैनिटाइजेशन", ur: "صفائی اور سینیٹائزیشن" },
  "Sterilizer cycle": { ar: "دورة جهاز التعقيم", hi: "स्टरलाइज़र साइकिल", ur: "سٹرلائزر سائیکل" },
  "Water tap flushing": { ar: "غسل صنابير المياه", hi: "वॉटर टैप फ्लशिंग", ur: "پانی نل فلشنگ" },
  "Pest control certificate": { ar: "شهادة مكافحة الآفات", hi: "पेस्ट कंट्रोल प्रमाणपत्र", ur: "پیسٹ کنٹرول سرٹیفکیٹ" },
  "Employee health cards": { ar: "بطاقات صحة الموظفين", hi: "कर्मचारी हेल्थ कार्ड", ur: "ملازم صحت کارڈ" },
  Daily: { ar: "يومي", hi: "दैनिक", ur: "روزانہ" },
  Weekly: { ar: "أسبوعي", hi: "साप्ताहिक", ur: "ہفتہ وار" },
  Monthly: { ar: "شهري", hi: "मासिक", ur: "ماہانہ" },
  Quarterly: { ar: "ربع سنوي", hi: "त्रैमासिक", ur: "سہ ماہی" },
  Yearly: { ar: "سنوي", hi: "वार्षिक", ur: "سالانہ" },
  Audit: { ar: "التدقيق", hi: "ऑडिट", ur: "آڈٹ" },
  "Cash Closing": { ar: "إغلاق النقدية", hi: "कैश क्लोजिंग", ur: "کیش کلوزنگ" },
  Reports: { ar: "التقارير", hi: "रिपोर्ट्स", ur: "رپورٹس" },
  Settings: { ar: "الإعدادات", hi: "सेटिंग्स", ur: "ترتیبات" },
  "Monday, 31 Aug · AED · VAT Off": { ar: "الاثنين، 31 أغسطس · درهم · الضريبة متوقفة", hi: "सोमवार, 31 अगस्त · AED · VAT बंद", ur: "پیر، 31 اگست · AED · VAT بند" },
  "Monday, 31 Aug · AED · VAT On": { ar: "الاثنين، 31 أغسطس · درهم · الضريبة مفعلة", hi: "सोमवार, 31 अगस्त · AED · VAT चालू", ur: "پیر، 31 اگست · AED · VAT آن" },
  "Monday, 31 Aug · AED · VAT optional": { ar: "الاثنين، 31 أغسطس · درهم · الضريبة اختيارية", hi: "सोमवार, 31 अगस्त · AED · VAT वैकल्पिक", ur: "پیر، 31 اگست · AED · VAT اختیاری" },
  "Salon Control Dashboard": { ar: "لوحة تحكم الصالون", hi: "सैलून कंट्रोल डैशबोर्ड", ur: "سیلون کنٹرول ڈیش بورڈ" },
  "Daily Control Dashboard": { ar: "لوحة التحكم اليومية", hi: "दैनिक कंट्रोल डैशबोर्ड", ur: "روزانہ کنٹرول ڈیش بورڈ" },
  "Master Dashboard": { ar: "لوحة المدير الرئيسية", hi: "मास्टर डैशबोर्ड", ur: "ماسٹر ڈیش بورڈ" },
  "Platform Admin": { ar: "مدير المنصة", hi: "प्लैटफ़ॉर्म एडमिन", ur: "پلیٹ فارم ایڈمن" },
  "Login required": { ar: "تسجيل الدخول مطلوب", hi: "लॉगिन आवश्यक", ur: "لاگ اِن ضروری" },
  "Product site": { ar: "موقع المنتج", hi: "प्रोडक्ट साइट", ur: "پروڈکٹ سائٹ" },
  "Language: English": { ar: "اللغة: الإنجليزية", hi: "भाषा: अंग्रेज़ी", ur: "زبان: انگریزی" },
  "Language: Arabic": { ar: "اللغة: العربية", hi: "भाषा: अरबी", ur: "زبان: عربی" },
  "Language: Hindi": { ar: "اللغة: الهندية", hi: "भाषा: हिंदी", ur: "زبان: ہندی" },
  "Language: Urdu": { ar: "اللغة: الأردية", hi: "भाषा: उर्दू", ur: "زبان: اردو" },
  "Expected cash today": { ar: "النقد المتوقع اليوم", hi: "आज अपेक्षित नकद", ur: "آج متوقع کیش" },
  "Cash sales minus cash expenses and purchases": { ar: "مبيعات النقد ناقص مصروفات ومشتريات النقد", hi: "नकद बिक्री में से नकद खर्च और खरीदारी घटाकर", ur: "کیش سیلز میں سے کیش اخراجات اور خریداری کم" },
  "Sales minus purchases and expenses": { ar: "المبيعات ناقص المشتريات والمصروفات", hi: "बिक्री में से खरीदारी और खर्चे घटाकर", ur: "سیلز میں سے خریداری اور اخراجات کم" },
  Sales: { ar: "المبيعات", hi: "बिक्री", ur: "سیلز" },
  "Sales incl. VAT": { ar: "المبيعات شاملة الضريبة", hi: "VAT सहित बिक्री", ur: "VAT سمیت سیلز" },
  "64 services · 7 retail items · no VAT added": { ar: "64 خدمة · 7 منتجات بيع · بدون ضريبة", hi: "64 सेवाएं · 7 रिटेल आइटम · VAT नहीं जोड़ा", ur: "64 خدمات · 7 ریٹیل آئٹمز · VAT شامل نہیں" },
  "64 services · VAT calculated separately": { ar: "64 خدمة · الضريبة محسوبة منفصلة", hi: "64 सेवाएं · VAT अलग से गणना", ur: "64 خدمات · VAT الگ حساب ہوا" },
  "Haircut, beard, color, facial": { ar: "قص شعر، لحية، صبغ، تنظيف بشرة", hi: "हेयरकट, दाढ़ी, कलर, फेशियल", ur: "بال کٹوانا، داڑھی، رنگ، فیشل" },
  "Supplier bills entered today": { ar: "فواتير الموردين المدخلة اليوم", hi: "आज दर्ज सप्लायर बिल", ur: "آج درج سپلائر بل" },
  "Blades, foam, oil, tools": { ar: "شفرات، رغوة، زيت، أدوات", hi: "ब्लेड, फोम, तेल, टूल्स", ur: "بلیڈ، فوم، تیل، اوزار" },
  "Tea, laundry, transport, repair": { ar: "شاي، مغسلة، نقل، صيانة", hi: "चाय, लॉन्ड्री, परिवहन, मरम्मत", ur: "چائے، لانڈری، ٹرانسپورٹ، مرمت" },
  "Tea, food, laundry, repair": { ar: "شاي، طعام، مغسلة، صيانة", hi: "चाय, खाना, लॉन्ड्री, मरम्मत", ur: "چائے، کھانا، لانڈری، مرمت" },
  "Secure demo access": { ar: "دخول تجريبي آمن", hi: "सुरक्षित डेमो एक्सेस", ur: "محفوظ ڈیمو رسائی" },
  "Enter workspace": { ar: "دخول مساحة العمل", hi: "वर्कस्पेस खोलें", ur: "ورک اسپیس کھولیں" },
  "Owner opens the full control room. Staff opens fast sale entry.": { ar: "المالك يفتح التحكم الكامل. الموظف يفتح البيع السريع.", hi: "मालिक पूरा कंट्रोल खोलता है। स्टाफ तेज बिक्री एंट्री खोलता है।", ur: "مالک مکمل کنٹرول کھولتا ہے۔ اسٹاف فوری سیل انٹری کھولتا ہے۔" },
  Role: { ar: "الدور", hi: "भूमिका", ur: "کردار" },
  "Shop Admin": { ar: "مدير المتجر", hi: "शॉप एडमिन", ur: "شاپ ایڈمن" },
  Owner: { ar: "المالك", hi: "मालिक", ur: "مالک" },
  Staff: { ar: "الموظف", hi: "स्टाफ", ur: "اسٹاف" },
  Cashier: { ar: "أمين الصندوق", hi: "कैशियर", ur: "کیشئر" },
  PIN: { ar: "الرمز السري", hi: "PIN", ur: "پن" },
  "Enter Salon Control": { ar: "دخول نظام الصالون", hi: "सैलून कंट्रोल खोलें", ur: "سیلون کنٹرول کھولیں" },
  "Owner PIN: 1234 · Cashier: 2222 · Staff: 1111": { ar: "رمز المالك: 1234 · الكاشير: 2222 · الموظف: 1111", hi: "मालिक PIN: 1234 · कैशियर: 2222 · स्टाफ: 1111", ur: "مالک پن: 1234 · کیشئر: 2222 · اسٹاف: 1111" },
  "Wrong PIN for this role.": { ar: "الرمز غير صحيح لهذا الدور.", hi: "इस भूमिका के लिए PIN गलत है।", ur: "اس کردار کے لئے پن غلط ہے۔" },
  "Today’s Flow": { ar: "مسار اليوم", hi: "आज का फ्लो", ur: "آج کا بہاؤ" },
  "The same workflow opens after login": { ar: "نفس سير العمل يفتح بعد تسجيل الدخول", hi: "लॉगिन के बाद यही वर्कफ्लो खुलता है", ur: "لاگ اِن کے بعد یہی ورک فلو کھلتا ہے" },
  "Everything connects to cash, stock and profit": { ar: "كل شيء مرتبط بالنقد والمخزون والربح", hi: "सब कुछ नकद, स्टॉक और लाभ से जुड़ता है", ur: "ہر چیز کیش، اسٹاک اور منافع سے جڑی ہے" },
  "Sale recorded": { ar: "تم تسجيل البيع", hi: "बिक्री दर्ज", ur: "سیل درج ہوئی" },
  "Services and custom items": { ar: "الخدمات والعناصر المخصصة", hi: "सेवाएं और कस्टम आइटम", ur: "خدمات اور کسٹم آئٹمز" },
  "Haircut, beard, facial or custom service": { ar: "قص شعر أو لحية أو تنظيف بشرة أو خدمة مخصصة", hi: "हेयरकट, दाढ़ी, फेशियल या कस्टम सेवा", ur: "بال، داڑھی، فیشل یا کسٹم سروس" },
  "Stock consumed": { ar: "تم استهلاك المخزون", hi: "स्टॉक उपयोग हुआ", ur: "اسٹاک استعمال ہوا" },
  "Blades, foam, oil, towels": { ar: "شفرات، رغوة، زيت، مناشف", hi: "ब्लेड, फोम, तेल, तौलिए", ur: "بلیڈ، فوم، تیل، تولیے" },
  "Blades, foam, oil, color, towels where relevant": { ar: "شفرات، رغوة، زيت، صبغ، مناشف حسب الخدمة", hi: "ब्लेड, फोम, तेल, कलर, जरूरत पर तौलिए", ur: "بلیڈ، فوم، تیل، رنگ، ضرورت پر تولیے" },
  "Money out entered": { ar: "تم إدخال المصروف", hi: "पैसा बाहर दर्ज", ur: "رقم باہر درج ہوئی" },
  "Purchases and expenses separated": { ar: "المشتريات والمصروفات مفصولة", hi: "खरीदारी और खर्चे अलग", ur: "خریداری اور اخراجات الگ" },
  "Purchases and expenses separated properly": { ar: "المشتريات والمصروفات مفصولة بشكل صحيح", hi: "खरीदारी और खर्चे सही तरह अलग", ur: "خریداری اور اخراجات صحیح الگ" },
  "Cash closed": { ar: "تم إغلاق النقدية", hi: "कैश बंद", ur: "کیش بند ہوا" },
  "Owner report is ready": { ar: "تقرير المالك جاهز", hi: "मालिक रिपोर्ट तैयार", ur: "مالک رپورٹ تیار ہے" },
  "Owner closes cash": { ar: "المالك يغلق النقدية", hi: "मालिक कैश बंद करता है", ur: "مالک کیش بند کرتا ہے" },
  "Shortage, reason and approval are logged": { ar: "يتم تسجيل النقص والسبب والموافقة", hi: "शॉर्टेज, कारण और मंजूरी लॉग होती है", ur: "کمی، وجہ اور منظوری لاگ ہوتی ہے" },
  "Owner Checks": { ar: "فحوصات المالك", hi: "मालिक जांच", ur: "مالک چیک" },
  "Items that need review before closing the day": { ar: "العناصر التي تحتاج مراجعة قبل إغلاق اليوم", hi: "दिन बंद करने से पहले समीक्षा वाले आइटम", ur: "دن بند کرنے سے پہلے جائزہ والے آئٹمز" },
  "Close day": { ar: "إغلاق اليوم", hi: "दिन बंद करें", ur: "دن بند کریں" },
  "Cash shortage pending": { ar: "نقص نقدي قيد المراجعة", hi: "कैश शॉर्टेज लंबित", ur: "کیش کمی زیر التوا" },
  "Expected AED 1,245 · counted AED 1,195": { ar: "المتوقع 1,245 درهم · المعدود 1,195 درهم", hi: "अपेक्षित AED 1,245 · गिना AED 1,195", ur: "متوقع AED 1,245 · گنا AED 1,195" },
  "Blade usage higher than shave count": { ar: "استهلاك الشفرات أعلى من عدد الحلاقة", hi: "शेव गिनती से ब्लेड उपयोग ज्यादा", ur: "شیو گنتی سے بلیڈ استعمال زیادہ" },
  Review: { ar: "مراجعة", hi: "समीक्षा", ur: "جائزہ" },
  "Dry cleaning expense added": { ar: "تمت إضافة مصروف التنظيف الجاف", hi: "ड्राई क्लीनिंग खर्च जोड़ा गया", ur: "ڈرائی کلیننگ خرچ شامل" },
  "AED 85 · cash paid · receipt missing": { ar: "85 درهم · دفع نقداً · الإيصال مفقود", hi: "AED 85 · नकद भुगतान · रसीद गायब", ur: "AED 85 · نقد ادا · رسید غائب" },
  Attach: { ar: "إرفاق", hi: "संलग्न करें", ur: "منسلک کریں" },
  "Business tax mode": { ar: "وضع ضريبة العمل", hi: "बिजनेस टैक्स मोड", ur: "کاروباری ٹیکس موڈ" },
  "VAT optional": { ar: "الضريبة اختيارية", hi: "VAT वैकल्पिक", ur: "VAT اختیاری" },
  "VAT Off": { ar: "الضريبة متوقفة", hi: "VAT बंद", ur: "VAT بند" },
  "VAT On": { ar: "الضريبة مفعلة", hi: "VAT चालू", ur: "VAT آن" },
  "VAT enabled · tax invoice mode": { ar: "الضريبة مفعلة · وضع الفاتورة الضريبية", hi: "VAT चालू · टैक्स इनवॉइस मोड", ur: "VAT فعال · ٹیکس انوائس موڈ" },
  "VAT on: tax invoice mode": { ar: "الضريبة مفعلة: وضع الفاتورة الضريبية", hi: "VAT चालू: टैक्स इनवॉइस मोड", ur: "VAT فعال: ٹیکس انوائس موڈ" },
  "VAT off: internal sale record only": { ar: "الضريبة متوقفة: سجل بيع داخلي فقط", hi: "VAT बंद: केवल आंतरिक बिक्री रिकॉर्ड", ur: "VAT بند: صرف اندرونی سیل ریکارڈ" },
  "Optional On": { ar: "اختياري مفعل", hi: "वैकल्पिक चालू", ur: "اختیاری آن" },
  "Optional Off": { ar: "اختياري متوقف", hi: "वैकल्पिक बंद", ur: "اختیاری بند" },
  "Turn VAT on": { ar: "تشغيل الضريبة", hi: "VAT चालू करें", ur: "VAT آن کریں" },
  "Turn VAT off": { ar: "إيقاف الضريبة", hi: "VAT बंद करें", ur: "VAT بند کریں" },
  "Receipt off": { ar: "الإيصال متوقف", hi: "रसीद बंद", ur: "رسید بند" },
  "Receipt on": { ar: "الإيصال مفعل", hi: "रसीद चालू", ur: "رسید آن" },
  Logout: { ar: "خروج", hi: "लॉगआउट", ur: "لاگ آؤٹ" },
  "New Sale": { ar: "بيع جديد", hi: "नई बिक्री", ur: "نئی سیل" },
  "Launch Setup": { ar: "إعداد التشغيل", hi: "लॉन्च सेटअप", ur: "لانچ سیٹ اپ" },
  "Editable Service Catalog": { ar: "كتالوج الخدمات القابل للتعديل", hi: "संपादन योग्य सेवा कैटलॉग", ur: "قابل تدوین سروس کیٹلاگ" },
  "Tax & Receipt Settings": { ar: "إعدادات الضريبة والإيصال", hi: "टैक्स और रसीद सेटिंग्स", ur: "ٹیکس اور رسید ترتیبات" },
  "Final data output": { ar: "مخرجات البيانات النهائية", hi: "अंतिम डेटा आउटपुट", ur: "حتمی ڈیٹا آؤٹ پٹ" },
  "Save Sale": { ar: "حفظ البيع", hi: "बिक्री सेव करें", ur: "سیل محفوظ کریں" },
  "Save Service": { ar: "حفظ الخدمة", hi: "सेवा सेव करें", ur: "سروس محفوظ کریں" },
  "Save Purchase": { ar: "حفظ المشتريات", hi: "खरीदारी सेव करें", ur: "خریداری محفوظ کریں" },
  "Save Expense": { ar: "حفظ المصروف", hi: "खर्च सेव करें", ur: "خرچ محفوظ کریں" },
  "Save Settings": { ar: "حفظ الإعدادات", hi: "सेटिंग्स सेव करें", ur: "ترتیبات محفوظ کریں" },
  Delete: { ar: "حذف", hi: "हटाएं", ur: "حذف کریں" },
  "Purchase deleted. Totals were recalculated.": { ar: "تم حذف المشتريات. تمت إعادة حساب الإجماليات.", hi: "खरीदारी हटाई गई। कुल फिर से गणना हुए।", ur: "خریداری حذف ہو گئی۔ کل دوبارہ حساب ہوا۔" },
  "Expense deleted. Totals were recalculated.": { ar: "تم حذف المصروف. تمت إعادة حساب الإجماليات.", hi: "खर्च हटाया गया। कुल फिर से गणना हुए।", ur: "خرچ حذف ہو گیا۔ کل دوبارہ حساب ہوا۔" },
  Supplier: { ar: "المورد", hi: "सप्लायर", ur: "سپلائر" },
  Items: { ar: "العناصر", hi: "आइटम", ur: "آئٹمز" },
  Payment: { ar: "الدفع", hi: "भुगतान", ur: "ادائیگی" },
  Total: { ar: "الإجمالي", hi: "कुल", ur: "کل" },
  Action: { ar: "إجراء", hi: "कार्रवाई", ur: "عمل" },
  Category: { ar: "الفئة", hi: "श्रेणी", ur: "زمرہ" },
  Amount: { ar: "المبلغ", hi: "राशि", ur: "رقم" },
  Note: { ar: "ملاحظة", hi: "नोट", ur: "نوٹ" },
  "Add Purchase": { ar: "إضافة مشتريات", hi: "खरीदारी जोड़ें", ur: "خریداری شامل کریں" },
  "Add Expense": { ar: "إضافة مصروف", hi: "खर्च जोड़ें", ur: "خرچ شامل کریں" },
  Qty: { ar: "الكمية", hi: "मात्रा", ur: "تعداد" },
  "Unit cost": { ar: "تكلفة الوحدة", hi: "यूनिट लागत", ur: "یونٹ لاگت" },
  Subtotal: { ar: "المجموع الفرعي", hi: "उप-योग", ur: "ذیلی کل" },
  "Print / Save PDF": { ar: "طباعة / حفظ PDF", hi: "PDF प्रिंट / सेव", ur: "PDF پرنٹ / محفوظ" },
  Service: { ar: "الخدمة", hi: "सेवा", ur: "سروس" },
  "Selected language": { ar: "اللغة المختارة", hi: "चुनी हुई भाषा", ur: "منتخب زبان" },
  Price: { ar: "السعر", hi: "कीमत", ur: "قیمت" },
  Recipe: { ar: "وصفة المخزون", hi: "स्टॉक रेसिपी", ur: "اسٹاک ترکیب" },
  Status: { ar: "الحالة", hi: "स्थिति", ur: "حالت" },
  Active: { ar: "نشط", hi: "सक्रिय", ur: "فعال" },
  Inactive: { ar: "غير نشط", hi: "निष्क्रिय", ur: "غیر فعال" },
  Hair: { ar: "الشعر", hi: "बाल", ur: "بال" },
  Beard: { ar: "اللحية", hi: "दाढ़ी", ur: "داڑھی" },
  Color: { ar: "الصبغ", hi: "कलर", ur: "رنگ" },
  Face: { ar: "الوجه", hi: "चेहरा", ur: "چہرہ" },
  Massage: { ar: "مساج", hi: "मसाज", ur: "مساج" },
  Custom: { ar: "مخصص", hi: "कस्टम", ur: "کسٹم" },
  Cash: { ar: "نقد", hi: "नकद", ur: "نقد" },
  Card: { ar: "بطاقة", hi: "कार्ड", ur: "کارڈ" },
  Bank: { ar: "بنك", hi: "बैंक", ur: "بینک" },
  Wallet: { ar: "محفظة", hi: "वॉलेट", ur: "والٹ" },
  Split: { ar: "تقسيم", hi: "स्प्लिट", ur: "تقسیم" },
  "Neck strip 1, shampoo optional": { ar: "شريط رقبة 1، شامبو اختياري", hi: "नेक स्ट्रिप 1, शैम्पू वैकल्पिक", ur: "نیک اسٹرپ 1، شیمپو اختیاری" },
  "Blade 1, foam 8ml, tissue 2": { ar: "شفرة 1، رغوة 8 مل، مناديل 2", hi: "ब्लेड 1, फोम 8ml, टिश्यू 2", ur: "بلیڈ 1، فوم 8ml، ٹشو 2" },
  "Machine use, tissue 1": { ar: "استخدام ماكينة، منديل 1", hi: "मशीन उपयोग, टिश्यू 1", ur: "مشین استعمال، ٹشو 1" },
  "Beard color 20ml, developer 20ml, gloves 1 pair": { ar: "صبغ لحية 20 مل، مطور 20 مل، قفازات زوج 1", hi: "दाढ़ी कलर 20ml, डेवलपर 20ml, दस्ताने 1 जोड़ी", ur: "داڑھی رنگ 20ml، ڈویلپر 20ml، دستانے 1 جوڑا" },
  "Color 60ml, developer 60ml, gloves 1 pair": { ar: "صبغ 60 مل، مطور 60 مل، قفازات زوج 1", hi: "कलर 60ml, डेवलपर 60ml, दस्ताने 1 जोड़ी", ur: "رنگ 60ml، ڈویلپر 60ml، دستانے 1 جوڑا" },
  "Cream 10ml, mask 1, towel laundry": { ar: "كريم 10 مل، ماسك 1، غسيل منشفة", hi: "क्रीम 10ml, मास्क 1, तौलिया लॉन्ड्री", ur: "کریم 10ml، ماسک 1، تولیہ لانڈری" },
  "Oil 15ml, towel laundry": { ar: "زيت 15 مل، غسيل منشفة", hi: "तेल 15ml, तौलिया लॉन्ड्री", ur: "تیل 15ml، تولیہ لانڈری" },
  Business: { ar: "النشاط", hi: "व्यवसाय", ur: "کاروبار" },
  Branch: { ar: "الفرع", hi: "शाखा", ur: "برانچ" },
  Products: { ar: "المنتجات", hi: "उत्पाद", ur: "مصنوعات" },
  "Opening Stock": { ar: "المخزون الافتتاحي", hi: "ओपनिंग स्टॉक", ur: "اوپننگ اسٹاک" },
  "Al Barsha Gents Barber": { ar: "حلاق رجال البرشاء", hi: "अल बरशा जेंट्स बारबर", ur: "البرشا جینٹس باربر" },
  "AED currency · non-VAT default": { ar: "عملة الدرهم · الضريبة متوقفة افتراضياً", hi: "AED मुद्रा · डिफ़ॉल्ट बिना VAT", ur: "AED کرنسی · ڈیفالٹ غیر VAT" },
  "Owner, cashier, barber roles": { ar: "أدوار المالك وأمين الصندوق والحلاق", hi: "मालिक, कैशियर, बारबर भूमिकाएं", ur: "مالک، کیشئر، حجام کردار" },
  "Haircut, shave, color, facial, custom": { ar: "قص شعر، حلاقة، صبغ، تنظيف بشرة، مخصص", hi: "हेयरकट, शेव, कलर, फेशियल, कस्टम", ur: "بال، شیو، رنگ، فیشل، کسٹم" },
  "Consumables, retail and tools": { ar: "مستهلكات وبيع تجزئة وأدوات", hi: "कंज्यूमेबल, रिटेल और टूल्स", ur: "استعمالی سامان، ریٹیل اور اوزار" },
  "Count stock before launch": { ar: "عد المخزون قبل التشغيل", hi: "लॉन्च से पहले स्टॉक गिनें", ur: "لانچ سے پہلے اسٹاک گنیں" },
  "Launch Checklist": { ar: "قائمة التشغيل", hi: "लॉन्च चेकलिस्ट", ur: "لانچ چیک لسٹ" },
  "Everything needed before the barber shop starts using the app live.": { ar: "كل ما يلزم قبل أن يبدأ الصالون استخدام التطبيق فعلياً.", hi: "बारबर शॉप के लाइव उपयोग से पहले सब जरूरी चीजें।", ur: "حجام دکان کے لائیو استعمال سے پہلے تمام ضروری چیزیں۔" },
  "Services and prices approved": { ar: "تم اعتماد الخدمات والأسعار", hi: "सेवाएं और कीमतें मंजूर", ur: "خدمات اور قیمتیں منظور" },
  "Staff PINs created": { ar: "تم إنشاء رموز الموظفين", hi: "स्टाफ PIN बनाए गए", ur: "اسٹاف پن بن گئے" },
  "VAT off confirmed": { ar: "تم تأكيد إيقاف الضريبة", hi: "VAT बंद पुष्टि", ur: "VAT بند تصدیق" },
  "Opening stock counted": { ar: "تم عد المخزون الافتتاحي", hi: "ओपनिंग स्टॉक गिना गया", ur: "اوپننگ اسٹاک گنا گیا" },
  "Suppliers added": { ar: "تمت إضافة الموردين", hi: "सप्लायर जोड़े गए", ur: "سپلائر شامل" },
  "Cash drawer opening balance set": { ar: "تم ضبط رصيد درج النقدية الافتتاحي", hi: "कैश ड्रॉअर ओपनिंग बैलेंस सेट", ur: "کیش دراز اوپننگ بیلنس سیٹ" },
  Checkout: { ar: "الدفع", hi: "चेकआउट", ur: "چیک آؤٹ" },
  "Staff records common services in a few taps": { ar: "الموظف يسجل الخدمات الشائعة بلمسات قليلة", hi: "स्टाफ आम सेवाएं कुछ टैप में दर्ज करता है", ur: "اسٹاف عام خدمات چند ٹیپس میں درج کرتا ہے" },
  "PIN staff mode": { ar: "وضع الموظف بالرمز", hi: "PIN स्टाफ मोड", ur: "پن اسٹاف موڈ" },
  "Discount reason": { ar: "سبب الخصم", hi: "छूट का कारण", ur: "ڈسکاؤنٹ وجہ" },
  "Selected service": { ar: "الخدمة المختارة", hi: "चुनी हुई सेवा", ur: "منتخب سروس" },
  "Tax mode": { ar: "وضع الضريبة", hi: "टैक्स मोड", ur: "ٹیکس موڈ" },
  Receipt: { ar: "الإيصال", hi: "रसीद", ur: "رسید" },
  "This will update cash expected, staff performance and stock consumption.": { ar: "سيتم تحديث النقد المتوقع وأداء الموظفين واستهلاك المخزون.", hi: "इससे अपेक्षित नकद, स्टाफ प्रदर्शन और स्टॉक उपयोग अपडेट होगा।", ur: "اس سے متوقع کیش، اسٹاف کارکردگی اور اسٹاک استعمال اپ ڈیٹ ہوگا۔" },
  "Add haircut, beard color, hair color, facial, massage or any custom service": { ar: "أضف قص شعر أو لون لحية أو لون شعر أو تنظيف بشرة أو مساج أو أي خدمة مخصصة", hi: "हेयरकट, दाढ़ी कलर, हेयर कलर, फेशियल, मसाज या कोई कस्टम सेवा जोड़ें", ur: "بال، داڑھی رنگ، بالوں کا رنگ، فیشل، مساج یا کوئی کسٹم سروس شامل کریں" },
  "Add Service": { ar: "إضافة خدمة", hi: "सेवा जोड़ें", ur: "سروس شامل کریں" },
  "Add / Edit Service": { ar: "إضافة / تعديل خدمة", hi: "सेवा जोड़ें / संपादित करें", ur: "سروس شامل / ترمیم کریں" },
  "Owner controls price, recipe and availability": { ar: "المالك يتحكم بالسعر والوصفة والتوفر", hi: "मालिक कीमत, रेसिपी और उपलब्धता नियंत्रित करता है", ur: "مالک قیمت، ترکیب اور دستیابی کنٹرول کرتا ہے" },
  "Service name": { ar: "اسم الخدمة", hi: "सेवा नाम", ur: "سروس نام" },
  Arabic: { ar: "العربية", hi: "अरबी", ur: "عربی" },
  Hindi: { ar: "الهندية", hi: "हिंदी", ur: "ہندی" },
  Urdu: { ar: "الأردية", hi: "उर्दू", ur: "اردو" },
  "Recipe / stock use": { ar: "الوصفة / استخدام المخزون", hi: "रेसिपी / स्टॉक उपयोग", ur: "ترکیب / اسٹاک استعمال" },
  "Supplier bills increase stock and affect cash/profit": { ar: "فواتير الموردين تزيد المخزون وتؤثر على النقد والربح", hi: "सप्लायर बिल स्टॉक बढ़ाते हैं और नकद/लाभ पर असर करते हैं", ur: "سپلائر بل اسٹاک بڑھاتے اور کیش/منافع پر اثر کرتے ہیں" },
  "Stock-in": { ar: "إدخال مخزون", hi: "स्टॉक-इन", ur: "اسٹاک اِن" },
  "Consumable, retail product or reusable tool": { ar: "مستهلك أو منتج بيع أو أداة قابلة لإعادة الاستخدام", hi: "कंज्यूमेबल, रिटेल उत्पाद या reusable tool", ur: "استعمالی سامان، ریٹیل پروڈکٹ یا دوبارہ استعمال ہونے والا اوزار" },
  "Item type": { ar: "نوع العنصر", hi: "आइटम प्रकार", ur: "آئٹم قسم" },
  Item: { ar: "العنصر", hi: "आइटम", ur: "آئٹم" },
  Unit: { ar: "الوحدة", hi: "यूनिट", ur: "یونٹ" },
  Discount: { ar: "الخصم", hi: "छूट", ur: "ڈسکاؤنٹ" },
  "Payment method": { ar: "طريقة الدفع", hi: "भुगतान विधि", ur: "ادائیگی طریقہ" },
  "Consumable stock": { ar: "مخزون مستهلك", hi: "कंज्यूमेबल स्टॉक", ur: "استعمالی اسٹاک" },
  "Retail product": { ar: "منتج بيع", hi: "रिटेल उत्पाद", ur: "ریٹیل پروڈکٹ" },
  "Reusable tool / asset": { ar: "أداة / أصل قابل لإعادة الاستخدام", hi: "रीयूजेबल टूल / एसेट", ur: "دوبارہ استعمال اوزار / اثاثہ" },
  "Operational supply": { ar: "مستلزمات تشغيل", hi: "ऑपरेशनल सप्लाई", ur: "آپریشنل سپلائی" },
  "Purchase will be saved, stock-in will be recorded, and cash/bank outflow will update.": { ar: "سيتم حفظ المشتريات وتسجيل دخول المخزون وتحديث خروج النقد/البنك.", hi: "खरीदारी सेव होगी, स्टॉक-इन दर्ज होगा, और नकद/बैंक आउटफ्लो अपडेट होगा।", ur: "خریداری محفوظ ہوگی، اسٹاک اِن درج ہوگا، اور کیش/بینک آؤٹ فلو اپ ڈیٹ ہوگا۔" },
  "Money spent that does not become stock": { ar: "أموال مصروفة لا تصبح مخزوناً", hi: "ऐसा पैसा जो स्टॉक नहीं बनता", ur: "ایسی رقم جو اسٹاک نہیں بنتی" },
  "Money-out": { ar: "خروج نقد", hi: "मनी-आउट", ur: "رقم باہر" },
  "Tea & Food": { ar: "شاي وطعام", hi: "चाय और खाना", ur: "چائے اور کھانا" },
  "Tea, coffee, water, staff meals": { ar: "شاي، قهوة، ماء، وجبات الموظفين", hi: "चाय, कॉफी, पानी, स्टाफ भोजन", ur: "چائے، کافی، پانی، اسٹاف کھانا" },
  "Dry Cleaning": { ar: "تنظيف جاف", hi: "ड्राई क्लीनिंग", ur: "ڈرائی کلیننگ" },
  "Towels, capes, laundry service": { ar: "مناشف، أغطية، خدمة مغسلة", hi: "तौलिए, केप, लॉन्ड्री सेवा", ur: "تولیے، کیپس، لانڈری سروس" },
  "Rent & Utilities": { ar: "الإيجار والخدمات", hi: "किराया और यूटिलिटीज", ur: "کرایہ اور یوٹیلیٹیز" },
  "Rent, electricity, water, internet": { ar: "إيجار، كهرباء، ماء، إنترنت", hi: "किराया, बिजली, पानी, इंटरनेट", ur: "کرایہ، بجلی، پانی، انٹرنیٹ" },
  Repairs: { ar: "الصيانة", hi: "मरम्मत", ur: "مرمت" },
  "Machine repair, chair repair, maintenance": { ar: "إصلاح ماكينة، إصلاح كرسي، صيانة", hi: "मशीन मरम्मत, कुर्सी मरम्मत, रखरखाव", ur: "مشین مرمت، کرسی مرمت، دیکھ بھال" },
  "Salary, advance, allowance": { ar: "راتب، سلفة، بدل", hi: "सैलरी, एडवांस, अलाउंस", ur: "تنخواہ، ایڈوانس، الاؤنس" },
  Other: { ar: "أخرى", hi: "अन्य", ur: "دیگر" },
  "Transport, cleaning, misc.": { ar: "نقل، تنظيف، متفرقات", hi: "परिवहन, सफाई, विविध", ur: "ٹرانسپورٹ، صفائی، متفرق" },
  "Cash expenses reduce expected cash": { ar: "المصروفات النقدية تخفض النقد المتوقع", hi: "नकद खर्च अपेक्षित नकद कम करते हैं", ur: "کیش اخراجات متوقع کیش کم کرتے ہیں" },
  Rent: { ar: "إيجار", hi: "किराया", ur: "کرایہ" },
  Utilities: { ar: "خدمات", hi: "यूटिलिटीज", ur: "یوٹیلیٹیز" },
  Repair: { ar: "إصلاح", hi: "मरम्मत", ur: "مرمت" },
  "Staff Advance": { ar: "سلفة موظف", hi: "स्टाफ एडवांस", ur: "اسٹاف ایڈوانس" },
  "Expense will be saved and cash closing will update if paid by cash.": { ar: "سيتم حفظ المصروف وتحديث إغلاق النقد إذا تم الدفع نقداً.", hi: "खर्च सेव होगा और नकद भुगतान पर कैश क्लोजिंग अपडेट होगी।", ur: "خرچ محفوظ ہوگا اور نقد ادائیگی پر کیش کلوزنگ اپ ڈیٹ ہوگی۔" },
  "Consumable Inventory": { ar: "مخزون المستهلكات", hi: "कंज्यूमेबल इन्वेंटरी", ur: "استعمالی اسٹاک" },
  "Used during services and deducted by recipes": { ar: "يستخدم أثناء الخدمات ويخصم حسب الوصفات", hi: "सेवाओं में उपयोग और रेसिपी से कटौती", ur: "خدمات میں استعمال اور ترکیب سے کٹوتی" },
  Blades: { ar: "الشفرات", hi: "ब्लेड", ur: "بلیڈ" },
  "Blades, foam, tissues": { ar: "شفرات، رغوة، مناديل", hi: "ब्लेड, फोम, टिश्यू", ur: "بلیڈ، فوم، ٹشو" },
  "Hair color, developer": { ar: "صبغ شعر، مطور", hi: "हेयर कलर, डेवलपर", ur: "بالوں کا رنگ، ڈویلپر" },
  "Clipper machine": { ar: "ماكينة حلاقة", hi: "क्लिपर मशीन", ur: "کلپر مشین" },
  "Shaving Foam": { ar: "رغوة الحلاقة", hi: "शेविंग फोम", ur: "شیونگ فوم" },
  "Hair Oil": { ar: "زيت الشعر", hi: "हेयर ऑयल", ur: "ہیئر آئل" },
  "Reusable Tools / Assets": { ar: "الأدوات / الأصول القابلة لإعادة الاستخدام", hi: "रीयूजेबल टूल्स / एसेट्स", ur: "دوبارہ استعمال اوزار / اثاثے" },
  "Tracked separately from consumable stock": { ar: "يتم تتبعها منفصلة عن المخزون المستهلك", hi: "कंज्यूमेबल स्टॉक से अलग ट्रैक", ur: "استعمالی اسٹاک سے الگ ٹریک" },
  "Trimming Machine": { ar: "ماكينة تشذيب", hi: "ट्रिमिंग मशीन", ur: "ٹرمنگ مشین" },
  Scissors: { ar: "مقصات", hi: "कैंची", ur: "قینچی" },
  "Hair Dryer": { ar: "مجفف شعر", hi: "हेयर ड्रायर", ur: "ہیئر ڈرائر" },
  Sterilizer: { ar: "معقم", hi: "स्टरलाइज़र", ur: "اسٹرلائزر" },
  "Close Day": { ar: "إغلاق اليوم", hi: "दिन बंद करें", ur: "دن بند کریں" },
  "Owner enters counted cash and approves shortage": { ar: "المالك يدخل النقد المعدود ويوافق على النقص", hi: "मालिक गिना हुआ नकद दर्ज कर शॉर्टेज मंजूर करता है", ur: "مالک گنا ہوا کیش درج کر کے کمی منظور کرتا ہے" },
  "Opening cash": { ar: "النقد الافتتاحي", hi: "ओपनिंग कैश", ur: "اوپننگ کیش" },
  "Cash sales": { ar: "مبيعات نقدية", hi: "नकद बिक्री", ur: "کیش سیلز" },
  "Cash expenses": { ar: "مصروفات نقدية", hi: "नकद खर्चे", ur: "کیش اخراجات" },
  "Cash purchases": { ar: "مشتريات نقدية", hi: "नकद खरीदारी", ur: "کیش خریداری" },
  "Actual cash counted": { ar: "النقد الفعلي المعدود", hi: "वास्तविक गिना नकद", ur: "اصل گنا ہوا کیش" },
  "Shortage reason": { ar: "سبب النقص", hi: "शॉर्टेज कारण", ur: "کمی وجہ" },
  "Approve Closing": { ar: "اعتماد الإغلاق", hi: "क्लोजिंग मंजूर करें", ur: "کلوزنگ منظور کریں" },
  "Audit Trail": { ar: "سجل التدقيق", hi: "ऑडिट ट्रेल", ur: "آڈٹ ٹریل" },
  "No silent changes after sale, purchase, expense or stock adjustment": { ar: "لا تغييرات صامتة بعد البيع أو الشراء أو المصروف أو تعديل المخزون", hi: "बिक्री, खरीदारी, खर्च या स्टॉक समायोजन के बाद कोई चुप बदलाव नहीं", ur: "سیل، خریداری، خرچ یا اسٹاک ایڈجسٹمنٹ کے بعد کوئی خاموش تبدیلی نہیں" },
  "Sale created": { ar: "تم إنشاء البيع", hi: "बिक्री बनी", ur: "سیل بنی" },
  "Purchase entered": { ar: "تم إدخال الشراء", hi: "खरीदारी दर्ज", ur: "خریداری درج" },
  "Expense entered": { ar: "تم إدخال المصروف", hi: "खर्च दर्ज", ur: "خرچ درج" },
  "Stock adjusted": { ar: "تم تعديل المخزون", hi: "स्टॉक समायोजित", ur: "اسٹاک ایڈجسٹ" },
  "Daily Closing Report": { ar: "تقرير الإغلاق اليومي", hi: "दैनिक क्लोजिंग रिपोर्ट", ur: "روزانہ کلوزنگ رپورٹ" },
  "Al Barsha Gents · Monday, 31 Aug · non-VAT internal records": { ar: "رجال البرشاء · الاثنين 31 أغسطس · سجلات داخلية بدون ضريبة", hi: "अल बरशा जेंट्स · सोमवार, 31 अगस्त · बिना VAT आंतरिक रिकॉर्ड", ur: "البرشا جینٹس · پیر، 31 اگست · غیر VAT اندرونی ریکارڈ" },
  "Total sales": { ar: "إجمالي المبيعات", hi: "कुल बिक्री", ur: "کل سیلز" },
  "Cash expected": { ar: "النقد المتوقع", hi: "अपेक्षित नकद", ur: "متوقع کیش" },
  "Staff commission": { ar: "عمولة الموظفين", hi: "स्टाफ कमीशन", ur: "اسٹاف کمیشن" },
  "Cash difference": { ar: "فرق النقد", hi: "कैश अंतर", ur: "کیش فرق" },
  "No records yet": { ar: "لا توجد سجلات بعد", hi: "अभी कोई रिकॉर्ड नहीं", ur: "ابھی کوئی ریکارڈ نہیں" },
  "Start with Quick Sale, Purchases and Expenses.": { ar: "ابدأ بالبيع السريع والمشتريات والمصروفات.", hi: "Quick Sale, Purchases और Expenses से शुरू करें।", ur: "Quick Sale، Purchases اور Expenses سے شروع کریں۔" },
  "Cash closing approved.": { ar: "تم اعتماد إغلاق النقدية.", hi: "कैश क्लोजिंग मंजूर हुई।", ur: "کیش کلوزنگ منظور ہو گئی۔" },
  "Shortage reason required.": { ar: "سبب النقص مطلوب.", hi: "शॉर्टेज कारण जरूरी है।", ur: "کمی وجہ ضروری ہے۔" },
  Section: { ar: "القسم", hi: "सेक्शन", ur: "سیکشن" },
  Result: { ar: "النتيجة", hi: "परिणाम", ur: "نتیجہ" },
  "Owner action": { ar: "إجراء المالك", hi: "मालिक कार्रवाई", ur: "مالک عمل" },
  Approved: { ar: "معتمد", hi: "मंजूर", ur: "منظور" },
  "Stock updated": { ar: "تم تحديث المخزون", hi: "स्टॉक अपडेट", ur: "اسٹاک اپ ڈیٹ" },
  "Reorder suggested": { ar: "اقتراح إعادة طلب", hi: "रीऑर्डर सुझाव", ur: "ری آرڈر تجویز" },
  "Reason required": { ar: "السبب مطلوب", hi: "कारण आवश्यक", ur: "وجہ ضروری" },
  "No silent edits": { ar: "لا تعديلات صامتة", hi: "कोई चुप एडिट नहीं", ur: "کوئی خاموش ترمیم نہیں" },
  Exports: { ar: "التصديرات", hi: "एक्सपोर्ट", ur: "ایکسپورٹس" },
  "Owner or accountant output": { ar: "مخرجات المالك أو المحاسب", hi: "मालिक या अकाउंटेंट आउटपुट", ur: "مالک یا اکاؤنٹنٹ آؤٹ پٹ" },
  "Daily PDF": { ar: "PDF يومي", hi: "दैनिक PDF", ur: "روزانہ PDF" },
  "Excel / CSV": { ar: "Excel / CSV", hi: "Excel / CSV", ur: "Excel / CSV" },
  "Cash shortage report": { ar: "تقرير نقص النقد", hi: "कैश शॉर्टेज रिपोर्ट", ur: "کیش کمی رپورٹ" },
  "Stock movement report": { ar: "تقرير حركة المخزون", hi: "स्टॉक मूवमेंट रिपोर्ट", ur: "اسٹاک موومنٹ رپورٹ" },
  "Export is not built yet.": { ar: "التصدير غير مبني بعد.", hi: "एक्सपोर्ट अभी नहीं बना है।", ur: "ایکسپورٹ ابھی نہیں بنا۔" },
  "AI owner summary": { ar: "ملخص ذكي للمالك", hi: "AI मालिक सारांश", ur: "AI مالک خلاصہ" },
  "How It Works": { ar: "طريقة العمل", hi: "यह कैसे काम करता है", ur: "یہ کیسے کام کرتا ہے" },
  "The app never forces VAT or invoices on a non-VAT barber shop": { ar: "التطبيق لا يفرض الضريبة أو الفواتير على صالون غير مسجل للضريبة", hi: "ऐप बिना VAT बारबर शॉप पर VAT या इनवॉइस मजबूर नहीं करता", ur: "ایپ غیر VAT حجام دکان پر VAT یا انوائس مجبور نہیں کرتی" },
  "Simple Receipt": { ar: "إيصال بسيط", hi: "सरल रसीद", ur: "سادہ رسید" },
  "VAT Off - internal records only": { ar: "الضريبة متوقفة - سجلات داخلية فقط", hi: "VAT बंद - केवल आंतरिक रिकॉर्ड", ur: "VAT بند - صرف اندرونی ریکارڈ" },
  "VAT On - tax invoice mode": { ar: "الضريبة مفعلة - وضع الفاتورة الضريبية", hi: "VAT चालू - टैक्स इनवॉइस मोड", ur: "VAT آن - ٹیکس انوائس موڈ" },
  "Customer receipt mode": { ar: "وضع إيصال العميل", hi: "ग्राहक रसीद मोड", ur: "کسٹمر رسید موڈ" },
  "Receipt disabled by default": { ar: "الإيصال متوقف افتراضياً", hi: "रसीद डिफ़ॉल्ट बंद", ur: "رسید ڈیفالٹ بند" },
  "Simple receipt optional": { ar: "إيصال بسيط اختياري", hi: "सरल रसीद वैकल्पिक", ur: "سادہ رسید اختیاری" },
  "WhatsApp receipt optional": { ar: "إيصال واتساب اختياري", hi: "WhatsApp रसीद वैकल्पिक", ur: "WhatsApp رسید اختیاری" },
  "Sale is saved as an internal business record. No VAT, no TRN and no tax invoice fields are required.": { ar: "يتم حفظ البيع كسجل داخلي. لا توجد ضريبة أو رقم ضريبي أو حقول فاتورة ضريبية مطلوبة.", hi: "बिक्री आंतरिक रिकॉर्ड के रूप में सेव होती है। VAT, TRN या टैक्स इनवॉइस फ़ील्ड जरूरी नहीं।", ur: "سیل اندرونی ریکارڈ کے طور پر محفوظ ہوتی ہے۔ VAT، TRN یا ٹیکس انوائس فیلڈز ضروری نہیں۔" },
  "Optional customer receipt with salon name, service, amount, staff and payment method.": { ar: "إيصال عميل اختياري باسم الصالون والخدمة والمبلغ والموظف وطريقة الدفع.", hi: "सैलून नाम, सेवा, राशि, स्टाफ और भुगतान विधि के साथ वैकल्पिक ग्राहक रसीद।", ur: "سیلون نام، سروس، رقم، اسٹاف اور ادائیگی طریقہ کے ساتھ اختیاری کسٹمر رسید۔" },
  "For registered salons only. TRN, VAT amount, invoice numbering and tax reports become active.": { ar: "للصالونات المسجلة فقط. يتم تفعيل الرقم الضريبي ومبلغ الضريبة وترقيم الفواتير وتقارير الضريبة.", hi: "केवल पंजीकृत सैलून के लिए। TRN, VAT राशि, इनवॉइस नंबरिंग और टैक्स रिपोर्ट सक्रिय होते हैं।", ur: "صرف رجسٹرڈ سیلون کے لئے۔ TRN، VAT رقم، انوائس نمبرنگ اور ٹیکس رپورٹس فعال ہوتی ہیں۔" }
  ,
  bill: { ar: "فاتورة", hi: "बिल", ur: "بل" },
  piece: { ar: "قطعة", hi: "पीस", ur: "پیس" },
  pcs: { ar: "قطعة", hi: "पीस", ur: "پیس" },
  "Tea and water for staff": { ar: "شاي وماء للموظفين", hi: "स्टाफ के लिए चाय और पानी", ur: "اسٹاف کے لئے چائے اور پانی" },
  "Towels and capes": { ar: "مناشف وأغطية", hi: "तौलिए और केप", ur: "تولیے اور کیپس" },
  "Supplier pickup": { ar: "استلام من المورد", hi: "सप्लायर पिकअप", ur: "سپلائر پک اپ" },
  "44 blades consumed · 38 shave services": { ar: "44 شفرة مستهلكة · 38 خدمة حلاقة", hi: "44 ब्लेड उपयोग · 38 शेव सेवाएं", ur: "44 بلیڈ استعمال · 38 شیو خدمات" },
  "156 pcs · minimum 80": { ar: "156 قطعة · الحد الأدنى 80", hi: "156 पीस · न्यूनतम 80", ur: "156 پیس · کم از کم 80" },
  "8 bottles · minimum 5": { ar: "8 عبوات · الحد الأدنى 5", hi: "8 बोतल · न्यूनतम 5", ur: "8 بوتل · کم از کم 5" },
  "1.5 L · minimum 1 L": { ar: "1.5 لتر · الحد الأدنى 1 لتر", hi: "1.5 L · न्यूनतम 1 L", ur: "1.5 L · کم از کم 1 L" },
  "900 ml · minimum 1 L": { ar: "900 مل · الحد الأدنى 1 لتر", hi: "900 ml · न्यूनतम 1 L", ur: "900 ml · کم از کم 1 L" },
  Good: { ar: "جيد", hi: "अच्छा", ur: "اچھا" },
  Low: { ar: "منخفض", hi: "कम", ur: "کم" },
  Asset: { ar: "أصل", hi: "एसेट", ur: "اثاثہ" },
  Tool: { ar: "أداة", hi: "टूल", ur: "اوزار" },
  Check: { ar: "فحص", hi: "जांच", ur: "چیک" },
  "Chair 2 · good condition": { ar: "كرسي 2 · حالة جيدة", hi: "कुर्सी 2 · अच्छी स्थिति", ur: "کرسی 2 · اچھی حالت" },
  "Rafiq · last sharpened 20 Aug": { ar: "رفيق · آخر سن 20 أغسطس", hi: "रफीक · आखिरी धार 20 अगस्त", ur: "رفیق · آخری تیز 20 اگست" },
  "Ladies section · repair due": { ar: "قسم السيدات · صيانة مستحقة", hi: "लेडीज सेक्शन · मरम्मत बाकी", ur: "لیڈیز سیکشن · مرمت باقی" },
  "Branch asset · warranty active": { ar: "أصل الفرع · الضمان فعال", hi: "शाखा एसेट · वारंटी सक्रिय", ur: "برانچ اثاثہ · وارنٹی فعال" },
  "Pending owner review": { ar: "بانتظار مراجعة المالك", hi: "मालिक समीक्षा लंबित", ur: "مالک جائزہ زیر التوا" },
  "Rafiq · Haircut · Cash · AED 25": { ar: "رفيق · قص شعر · نقد · 25 درهم", hi: "रफीक · हेयरकट · नकद · AED 25", ur: "رفیق · بال کٹوانا · نقد · AED 25" },
  "Owner · Blades · 100 pcs · AED 120": { ar: "المالك · شفرات · 100 قطعة · 120 درهم", hi: "मालिक · ब्लेड · 100 पीस · AED 120", ur: "مالک · بلیڈ · 100 پیس · AED 120" },
  "Owner · Tea & Food · AED 35 · Cash": { ar: "المالك · شاي وطعام · 35 درهم · نقد", hi: "मालिक · चाय और खाना · AED 35 · नकद", ur: "مالک · چائے اور کھانا · AED 35 · نقد" },
  "Owner · Blades · -6 · reason required": { ar: "المالك · شفرات · -6 · السبب مطلوب", hi: "मालिक · ब्लेड · -6 · कारण आवश्यक", ur: "مالک · بلیڈ · -6 · وجہ ضروری" },
  "64 services recorded; top service Haircut": { ar: "تم تسجيل 64 خدمة؛ أعلى خدمة قص شعر", hi: "64 सेवाएं दर्ज; शीर्ष सेवा हेयरकट", ur: "64 خدمات درج؛ ٹاپ سروس بال کٹوانا" },
  "Blades, foam, tissues, hair color and clipper machine entered": { ar: "تم إدخال الشفرات والرغوة والمناديل وصبغ الشعر وماكينة الحلاقة", hi: "ब्लेड, फोम, टिश्यू, हेयर कलर और क्लिपर मशीन दर्ज", ur: "بلیڈ، فوم، ٹشو، بالوں کا رنگ اور کلپر مشین درج" },
  "Tea, dry cleaning, repair and transport captured": { ar: "تم تسجيل الشاي والتنظيف الجاف والصيانة والنقل", hi: "चाय, ड्राई क्लीनिंग, मरम्मत और परिवहन दर्ज", ur: "چائے، ڈرائی کلیننگ، مرمت اور ٹرانسپورٹ درج" },
  "Receipts pending for 1 item": { ar: "إيصال معلق لعنصر واحد", hi: "1 आइटम की रसीद लंबित", ur: "1 آئٹم کی رسید زیر التوا" },
  "Developer 20 Vol below minimum level": { ar: "Developer 20 Vol أقل من الحد الأدنى", hi: "Developer 20 Vol न्यूनतम स्तर से नीचे", ur: "Developer 20 Vol کم از کم سطح سے نیچے" },
  "AED 50 shortage after counted cash": { ar: "نقص 50 درهم بعد عد النقد", hi: "गिने नकद के बाद AED 50 शॉर्टेज", ur: "گنے کیش کے بعد AED 50 کمی" },
  "7 sensitive actions logged today": { ar: "تم تسجيل 7 إجراءات حساسة اليوم", hi: "आज 7 संवेदनशील कार्रवाइयां लॉग", ur: "آج 7 حساس اعمال لاگ ہوئے" },
  "Cash is short by AED 50. Blade usage is higher than recorded shave services. Developer stock should be reordered within 2 days.": { ar: "يوجد نقص نقدي 50 درهماً. استخدام الشفرات أعلى من خدمات الحلاقة المسجلة. يجب إعادة طلب المخزون خلال يومين.", hi: "कैश AED 50 कम है। ब्लेड उपयोग दर्ज शेव सेवाओं से ज्यादा है। डेवलपर स्टॉक 2 दिनों में फिर मंगाना चाहिए।", ur: "کیش AED 50 کم ہے۔ بلیڈ استعمال درج شیو خدمات سے زیادہ ہے۔ ڈویلپر اسٹاک 2 دن میں دوبارہ منگوانا چاہیے۔" }
};

const textNodeOriginals = new WeakMap();
const reverseTranslations = {};

Object.entries(uiTranslations).forEach(([english, translations]) => {
  Object.values(translations).forEach((translated) => {
    reverseTranslations[translated] = english;
  });
});

function isoOffset(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultComplianceDocuments(country = "AE") {
  const profile = countryProfiles[country] || countryProfiles.AE;
  return [
    { type: profile.tenancyName, holder: "Shop premises", number: "", issueDate: isoOffset(-335), expiryDate: isoOffset(30), renewalCost: 0, evidence: "", reminderDays: 30, status: "DueSoon" },
    { type: "Trade licence", holder: "Company", number: "", issueDate: isoOffset(-330), expiryDate: isoOffset(45), renewalCost: 0, evidence: "", reminderDays: 45, status: "Ready" },
    { type: "Pest control certificate", holder: "Shop premises", number: "", issueDate: isoOffset(-25), expiryDate: isoOffset(5), renewalCost: 0, evidence: "", reminderDays: 7, status: "DueSoon" },
    { type: profile.healthName, holder: "All barbers", number: "", issueDate: isoOffset(-330), expiryDate: isoOffset(20), renewalCost: 0, evidence: "", reminderDays: 30, status: "DueSoon" },
    { type: "Staff visa / residence permit", holder: "Staff file", number: "", issueDate: isoOffset(-650), expiryDate: isoOffset(60), renewalCost: 0, evidence: "", reminderDays: 60, status: "Ready" },
    { type: "Staff vaccination record", holder: "Staff file", number: "", issueDate: isoOffset(-300), expiryDate: isoOffset(90), renewalCost: 0, evidence: "", reminderDays: 30, status: "Ready" }
  ];
}

const defaultState = {
  activeShopId: "al-barsha-gents",
  shops: [
    { id: "al-barsha-gents", shopCode: "ALBARSHA001", name: "Al Barsha Gents", location: "Al Barsha", country: "AE", owner: "Owner", ownerUsername: "owner.albarsha", currency: "AED", enabled: true }
  ],
  shopStates: {},
  services: [
    { name: "Haircut", names: { ar: "قص شعر", hi: "हेयरकट", ur: "بال کٹوانا" }, category: "Hair", price: 25, recipe: "Neck strip 1, shampoo optional", active: true },
    { name: "Shave", names: { ar: "حلاقة", hi: "शेव", ur: "شیو" }, category: "Beard", price: 15, recipe: "Blade 1, foam 8ml, tissue 2", active: true },
    { name: "Beard Trim", names: { ar: "تشذيب اللحية", hi: "दाढ़ी ट्रिम", ur: "داڑھی ٹرم" }, category: "Beard", price: 10, recipe: "Machine use, tissue 1", active: true },
    { name: "Beard Color", names: { ar: "لون اللحية", hi: "दाढ़ी कलर", ur: "داڑھی رنگ" }, category: "Color", price: 45, recipe: "Beard color 20ml, developer 20ml, gloves 1 pair", active: true },
    { name: "Hair Color", names: { ar: "صبغ الشعر", hi: "हेयर कलर", ur: "بالوں کا رنگ" }, category: "Color", price: 80, recipe: "Color 60ml, developer 60ml, gloves 1 pair", active: true },
    { name: "Facial", names: { ar: "تنظيف البشرة", hi: "फेशियल", ur: "فیشل" }, category: "Face", price: 60, recipe: "Cream 10ml, mask 1, towel laundry", active: true },
    { name: "Head Massage", names: { ar: "مساج الرأس", hi: "हेड मसाज", ur: "سر کا مساج" }, category: "Massage", price: 35, recipe: "Oil 15ml, towel laundry", active: true }
  ],
  purchases: [],
  expenses: [],
  receiptEnabled: false,
  vatEnabled: false,
  openingCash: 200,
  sales: [],
  customers: [
    { id: "walk-in-guest", name: "Walk-in Guest", phone: "", preference: "No saved preference", riskNote: "", visits: 0, noShows: 0, lastVisit: "" },
    { id: "ali-khan", name: "Ali Khan", phone: "+971 50 000 0000", preference: "Skin fade with beard line", riskNote: "Prefers Rafiq", visits: 3, noShows: 0, lastVisit: isoOffset(-10) },
    { id: "omar-saeed", name: "Omar Saeed", phone: "+971 55 111 2222", preference: "Hair color touch-up", riskNote: "Patch test before color", visits: 1, noShows: 1, lastVisit: isoOffset(-32) }
  ],
  queueTickets: [
    { id: "q-1001", customerId: "ali-khan", service: "Haircut", staff: "Rafiq", type: "Walk-in", date: isoOffset(0), time: "10:15", deposit: 0, status: "Waiting", createdAt: new Date().toISOString() },
    { id: "q-1002", customerId: "omar-saeed", service: "Beard Color", staff: "Sameer", type: "Appointment", date: isoOffset(0), time: "11:30", deposit: 20, status: "Booked", createdAt: new Date().toISOString() }
  ],
  appointments: [],
  auditLog: [],
  cashClosings: [],
  staffPayments: [
    { staff: "Rafiq", paidAt: "" },
    { staff: "Sameer", paidAt: "" },
    { staff: "Imran", paidAt: "" }
  ],
  users: [],
  checklist: {
    servicesApproved: true,
    staffPins: true,
    vatConfirmed: true,
    openingStock: false,
    suppliersAdded: false,
    openingCash: false
  },
  inspectionRecords: [
    { record: "Cleaning & sanitization", cadence: "Daily", dueDate: isoOffset(0), signedBy: "", evidence: "", signedAt: "" },
    { record: "Sterilizer cycle", cadence: "Daily", dueDate: isoOffset(0), signedBy: "", evidence: "", signedAt: "" },
    { record: "Water tap flushing", cadence: "Quarterly", dueDate: isoOffset(1), signedBy: "", evidence: "", signedAt: "" },
    { record: "Pest control certificate", cadence: "Monthly", dueDate: isoOffset(-5), signedBy: "", evidence: "", signedAt: "" },
    { record: "Employee health cards", cadence: "Yearly", dueDate: isoOffset(7), signedBy: "", evidence: "", signedAt: "" }
  ],
  hygieneLogs: [],
  complianceDocuments: defaultComplianceDocuments("AE"),
  documentChain: [
    { name: "Ejari", dueDate: isoOffset(15), evidence: "" },
    { name: "Trade licence", dueDate: isoOffset(23), evidence: "" },
    { name: "Establishment card", dueDate: isoOffset(28), evidence: "" },
    { name: "Visas / EID / health cards", dueDate: isoOffset(30), evidence: "" }
  ],
  montajiItems: [
    { sku: "Hair color 5.0", status: "Needs ref", action: "Upload supplier proof" },
    { sku: "Beard dye black", status: "Needs ref", action: "Upload supplier proof" },
    { sku: "Face mask charcoal", status: "Unknown", action: "Do not reorder until checked" }
  ]
};

const shopStateFields = [
  "services",
  "purchases",
  "expenses",
  "receiptEnabled",
  "vatEnabled",
  "openingCash",
  "sales",
  "customers",
  "queueTickets",
  "appointments",
  "auditLog",
  "cashClosings",
  "staffPayments",
  "users",
  "checklist",
  "inspectionRecords",
  "hygieneLogs",
  "complianceDocuments",
  "documentChain",
  "montajiItems"
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createShopState(overrides = {}) {
  const state = {};
  shopStateFields.forEach((field) => {
    state[field] = clone(defaultState[field]);
  });
  state.users = defaultShopUsers();
  return { ...state, ...overrides };
}

function legacyShopState(source) {
  const state = {};
  shopStateFields.forEach((field) => {
    state[field] = source[field] !== undefined ? source[field] : defaultState[field];
  });
  return createShopState(state);
}

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    memoryState = stored;
    return { ...defaultState, ...stored };
  } catch {
    return memoryState ? { ...defaultState, ...memoryState } : { ...defaultState };
  }
}

let state = loadState();
let shops = state.shops?.length ? state.shops : clone(defaultState.shops);
let activeShopId = state.activeShopId || shops[0].id;
let shopStates = state.shopStates || {};
shops = shops.map((shop, index) => ({
  ...shop,
  shopCode: shop.shopCode || (index === 0 ? "ALBARSHA001" : shopCodeFromName(shop.name || `Shop ${index + 1}`)),
  ownerUsername: shop.ownerUsername || uniqueUsername(`owner.${shop.name || "shop"}`, shop.id),
  country: shop.country || currencyToCountry[shop.currency] || "AE",
  currency: countryProfiles[shop.country || currencyToCountry[shop.currency] || "AE"]?.currency || shop.currency || "AED"
}));
if (!shopStates[activeShopId]) {
  shopStates[activeShopId] = legacyShopState(state);
}
let activeShopState = shopStates[activeShopId];
let services = activeShopState.services;
let purchases = activeShopState.purchases;
let expenses = activeShopState.expenses;
let selectedService = services[0];
let selectedSaleServices = selectedService ? [selectedService] : [];
let receiptEnabled = activeShopState.receiptEnabled;
let vatEnabled = activeShopState.vatEnabled;
let openingCash = Number(activeShopState.openingCash ?? defaultState.openingCash);
let activeLanguage = state.activeLanguage || "en";
let sales = activeShopState.sales || [];
let customers = activeShopState.customers?.length ? activeShopState.customers : clone(defaultState.customers);
let queueTickets = activeShopState.queueTickets || clone(defaultState.queueTickets);
let appointments = activeShopState.appointments || [];
let auditLog = activeShopState.auditLog || [];
let cashClosings = activeShopState.cashClosings || [];
let staffPayments = activeShopState.staffPayments || defaultState.staffPayments;
let checklist = { ...defaultState.checklist, ...(activeShopState.checklist || {}) };
let inspectionRecords = activeShopState.inspectionRecords || defaultState.inspectionRecords;
let hygieneLogs = activeShopState.hygieneLogs || defaultState.hygieneLogs;
let complianceDocuments = activeShopState.complianceDocuments || defaultComplianceDocuments(currentShop()?.country || "AE");
let documentChain = activeShopState.documentChain || defaultState.documentChain;
let montajiItems = activeShopState.montajiItems || defaultState.montajiItems;
let activeSaleCategory = "All";
let currentRole = "Owner";
let currentUser = { ...platformAccount };
let cloudIdentity = null;
let cloudSaveTimer = null;
let cloudHydrating = false;
const isLocalDemo = ["localhost", "127.0.0.1"].includes(window.location.hostname) && !new URLSearchParams(window.location.search).has("cloud");
const backendRoleLabels = {
  platform_admin: "Platform Admin",
  owner: "Owner",
  shop_admin: "Shop Admin",
  cashier: "Cashier",
  staff: "Staff"
};
const backendRoleValues = Object.fromEntries(Object.entries(backendRoleLabels).map(([key, value]) => [value, key]));

if (!isLocalDemo) {
  document.querySelector(".login-card .status-pill").textContent = "Secure cloud access";
  document.querySelector(".login-card small").hidden = true;
}

function setSyncStatus(label, syncState = "") {
  const status = document.getElementById("syncStatus");
  if (!status) return;
  status.hidden = !label;
  status.textContent = label;
  status.dataset.state = syncState;
}

const cloudCollections = [
  ["services", "service"],
  ["customers", "customer"],
  ["appointments", "appointment"],
  ["queueTickets", "queue_ticket"],
  ["sales", "sale"],
  ["purchases", "purchase"],
  ["expenses", "expense"],
  ["cashClosings", "cash_closing"],
  ["staffPayments", "staff_payment"],
  ["inspectionRecords", "inspection"],
  ["hygieneLogs", "hygiene_log"],
  ["complianceDocuments", "compliance_document"],
  ["documentChain", "document_chain"],
  ["montajiItems", "product_registration"]
];

const cloudWritableTypes = {
  "Platform Admin": cloudCollections.map(([, type]) => type).concat("shop_setting"),
  Owner: cloudCollections.map(([, type]) => type).concat("shop_setting"),
  "Shop Admin": cloudCollections.map(([, type]) => type).concat("shop_setting"),
  Cashier: ["customer", "appointment", "queue_ticket", "sale", "purchase", "expense", "cash_closing"],
  Staff: ["queue_ticket", "sale"]
};

function cloudExternalId(item, type, index) {
  if (item.id) return String(item.id);
  const source = item.createdAt || item.name || item.record || item.type || item.sku || item.staff;
  item.id = source
    ? `${type}-${String(source).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index}`
    : `${type}-${crypto.randomUUID()}`;
  return item.id;
}

function buildCloudRecords() {
  const targetShopId = cloudTargetShopId();
  if (!targetShopId) return [];
  captureActiveShopState();
  const allowed = new Set(cloudWritableTypes[currentRole] || []);
  const records = [];
  cloudCollections.forEach(([field, type]) => {
    if (!allowed.has(type)) return;
    (activeShopState[field] || []).forEach((item, index) => {
      records.push({
        shop_id: targetShopId,
        record_type: type,
        external_id: cloudExternalId(item, type, index),
        data: item,
        deleted_at: null
      });
    });
  });
  if (allowed.has("shop_setting")) {
    records.push({
      shop_id: targetShopId,
      record_type: "shop_setting",
      external_id: "operations",
      data: { receiptEnabled, vatEnabled, openingCash, checklist },
      deleted_at: null
    });
  }
  return records;
}

function scheduleCloudSave() {
  if (isLocalDemo || cloudHydrating || !cloudTargetShopId()) return;
  clearTimeout(cloudSaveTimer);
  setSyncStatus("Saving…", "saving");
  cloudSaveTimer = setTimeout(async () => {
    try {
      await window.SalonBackend.upsertRecords(buildCloudRecords());
      setSyncStatus("Saved", "connected");
    } catch (error) {
      console.error("Cloud save failed", error);
      setSyncStatus("Save failed", "error");
    }
  }, 350);
}

async function deleteCloudRecord(item, type, index = 0) {
  if (isLocalDemo) return true;
  const shopId = cloudTargetShopId();
  if (!shopId) return false;
  const externalId = cloudExternalId(item, type, index);
  setSyncStatus("Deleting…", "saving");
  try {
    await window.SalonBackend.softDeleteRecord(shopId, type, externalId);
    setSyncStatus("Saved", "connected");
    return true;
  } catch (error) {
    console.error("Cloud delete failed", error);
    setSyncStatus("Delete failed", "error");
    return false;
  }
}

function cloudTargetShopId() {
  if (cloudIdentity?.shop_id) return cloudIdentity.shop_id;
  if (currentRole === "Platform Admin" && /^[0-9a-f-]{36}$/i.test(activeShopId || "")) return activeShopId;
  return null;
}

async function loadCloudUsers(shopId) {
  if (!shopId || isLocalDemo) return;
  const result = await window.SalonBackend.loadUsers(shopId);
  const target = shopStates[shopId] || createShopState({ customers: [], queueTickets: [] });
  target.users = (result.users || []).map((user) => ({ ...user, role: backendRoleLabels[user.role] || user.role }));
  shopStates[shopId] = target;
}

async function loadCloudShopState(shopId) {
  const rows = await window.SalonBackend.loadRecords(shopId);
  cloudHydrating = true;
  try {
    const target = shopStates[shopId] || createShopState({ customers: [], queueTickets: [] });
    cloudCollections.forEach(([field, type]) => {
      target[field] = rows.filter((row) => row.record_type === type).map((row) => row.data);
    });
    const settings = rows.find((row) => row.record_type === "shop_setting" && row.external_id === "operations")?.data;
    if (settings) {
      Object.assign(target, settings);
      const shop = shops.find((candidate) => candidate.id === shopId);
      if (shop) shop.location = settings.location || shop.location || "";
    }
    shopStates[shopId] = target;
  } finally {
    cloudHydrating = false;
  }
}

async function prepareCloudIdentity(identity, username = "Account") {
  const role = backendRoleLabels[identity.role];
  if (!role) throw new Error("Account role is not supported");
  cloudIdentity = identity;
  if (identity.shop_id) {
    let shop = shops.find((candidate) => candidate.id === identity.shop_id);
    if (!shop) {
      shop = {
        id: identity.shop_id,
        shopCode: identity.shop_code,
        name: identity.shop_name,
        location: "",
        country: "AE",
        currency: "AED",
        enabled: true
      };
      shops.push(shop);
      shopStates[shop.id] = createShopState({ customers: [], queueTickets: [] });
    }
    activeShopId = shop.id;
    await loadCloudShopState(shop.id);
    if (["Platform Admin", "Owner", "Shop Admin"].includes(role)) await loadCloudUsers(shop.id);
  } else {
    const remoteShops = await window.SalonBackend.loadShops();
    shops = remoteShops.map((shop) => ({
      id: shop.id,
      shopCode: shop.code,
      name: shop.name,
      location: "",
      country: shop.country,
      currency: countryProfiles[shop.country]?.currency || "AED",
      enabled: shop.status === "active",
      status: shop.status
    }));
    activeShopId = shops[0]?.id || "";
    if (activeShopId) await Promise.all([loadCloudShopState(activeShopId), loadCloudUsers(activeShopId)]);
  }
  return { ok: true, role, user: { name: username, username, role }, shopId: activeShopId };
}

async function authenticateCloudLogin({ shopCode, username, password }) {
  const result = await window.SalonBackend.signIn(shopCode, username, password);
  return prepareCloudIdentity(result.identity, username);
}

function enterAuthenticatedApp(login) {
  if (isLocalDemo) captureActiveShopState();
  activeShopId = login.shopId;
  currentRole = login.role;
  currentUser = login.user;
  hydrateActiveShop();
  removeLegacyDemoRows();
  migrateServices();
  window.scrollTo({ top: 0, left: 0 });
  document.body.classList.add("is-authenticated");
  const frontpage = document.getElementById("frontpage");
  const appShell = document.getElementById("appShell");
  frontpage.hidden = true;
  appShell.hidden = false;
  frontpage.classList.add("front-hidden");
  appShell.classList.remove("app-hidden");
  applyRoleAccess();
  setSyncStatus(isLocalDemo ? "Local demo" : "Cloud connected", isLocalDemo ? "local" : "connected");
  syncShopIdentity();
  syncTaxSettings();
  showView(currentRole === "Platform Admin" ? "master-admin" : currentRole === "Staff" ? "quick-sale" : "dashboard");
}

async function restoreCloudLogin() {
  if (isLocalDemo) return;
  try {
    const restored = await window.SalonBackend.restore();
    if (!restored?.identity) return;
    const email = restored.session?.user?.email || "";
    const username = email.split("@")[0].split(".").slice(1).join(".") || "Account";
    const login = await prepareCloudIdentity(restored.identity, username);
    enterAuthenticatedApp(login);
  } catch (error) {
    console.error("Session restore failed", error);
  }
}

function defaultShopUsers(ownerName = "Owner", ownerUsername = "owner.albarsha", ownerPassword = "1234") {
  return [
    { name: ownerName, username: ownerUsername, password: ownerPassword, role: "Owner", active: true, createdAt: new Date().toISOString() },
    { name: "Shop Admin", username: "admin.albarsha", password: "9999", role: "Shop Admin", active: true, createdAt: new Date().toISOString() },
    { name: "Cashier", username: "cashier.albarsha", password: "2222", role: "Cashier", active: true, createdAt: new Date().toISOString() },
    { name: "Staff", username: "staff.albarsha", password: "1111", role: "Staff", active: true, createdAt: new Date().toISOString() }
  ];
}

function currentShop() {
  return shops.find((shop) => shop.id === activeShopId) || shops[0];
}

function currentShopLabel() {
  const shop = currentShop();
  return shop ? shop.name : "Salon Control";
}

function currentShopLocation() {
  const shop = currentShop();
  return shop ? shop.location : "Al Barsha";
}

function currentShopCode() {
  const shop = currentShop();
  return shop?.shopCode || "ALBARSHA001";
}

function currentCountryProfile(shop = currentShop()) {
  const country = shop?.country || currencyToCountry[shop?.currency] || "AE";
  return countryProfiles[country] || countryProfiles.AE;
}

function currentCurrency(shop = currentShop()) {
  return currentCountryProfile(shop).currency;
}

function captureActiveShopState() {
  shopStates[activeShopId] = {
    services,
    purchases,
    expenses,
    receiptEnabled,
    vatEnabled,
    openingCash,
    sales,
    customers,
    queueTickets,
    appointments,
    auditLog,
    cashClosings,
    staffPayments,
    users: activeShopState.users || (isLocalDemo ? defaultShopUsers(currentShop()?.owner || "Owner", currentShop()?.ownerUsername || "owner.albarsha") : []),
    checklist,
    inspectionRecords,
    hygieneLogs,
    complianceDocuments,
    documentChain,
    montajiItems
  };
}

function hydrateActiveShop() {
  activeShopState = shopStates[activeShopId] || createShopState();
  shopStates[activeShopId] = activeShopState;
  services = activeShopState.services || clone(defaultState.services);
  purchases = activeShopState.purchases || [];
  expenses = activeShopState.expenses || [];
  selectedService = services.find((service) => service.active) || services[0] || { name: "No service", price: 0, active: false };
  selectedSaleServices = selectedService.active === false ? [] : [selectedService];
  receiptEnabled = !!activeShopState.receiptEnabled;
  vatEnabled = !!activeShopState.vatEnabled;
  openingCash = Number(activeShopState.openingCash ?? defaultState.openingCash);
  sales = activeShopState.sales || [];
  customers = Array.isArray(activeShopState.customers) ? activeShopState.customers : clone(defaultState.customers);
  queueTickets = Array.isArray(activeShopState.queueTickets) ? activeShopState.queueTickets : clone(defaultState.queueTickets);
  appointments = activeShopState.appointments || [];
  auditLog = activeShopState.auditLog || [];
  cashClosings = activeShopState.cashClosings || [];
  staffPayments = activeShopState.staffPayments || clone(defaultState.staffPayments);
  activeShopState.users = Array.isArray(activeShopState.users)
    ? activeShopState.users
    : (isLocalDemo ? defaultShopUsers(currentShop()?.owner || "Owner", currentShop()?.ownerUsername || "owner.albarsha") : []);
  checklist = { ...defaultState.checklist, ...(activeShopState.checklist || {}) };
  inspectionRecords = activeShopState.inspectionRecords || clone(defaultState.inspectionRecords);
  hygieneLogs = activeShopState.hygieneLogs || [];
  complianceDocuments = activeShopState.complianceDocuments || defaultComplianceDocuments(currentShop()?.country || "AE");
  ensureComplianceDocumentsForCountry();
  documentChain = activeShopState.documentChain || clone(defaultState.documentChain);
  montajiItems = activeShopState.montajiItems || clone(defaultState.montajiItems);
  activeSaleCategory = "All";
}

function slugify(value) {
  const base = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shop";
  let id = base;
  let count = 2;
  while (shops.some((shop) => shop.id === id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

function shopCodeFromName(value) {
  const base = value.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8) || "SHOP";
  let code = `${base}001`;
  let count = 2;
  while (shops.some((shop) => (shop.shopCode || "").toUpperCase() === code)) {
    code = `${base}${String(count).padStart(3, "0")}`;
    count += 1;
  }
  return code;
}

function uniqueUsername(base, shopId = activeShopId) {
  const clean = base.toLowerCase().replace(/[^a-z0-9.]+/g, ".").replace(/^\.+|\.+$/g, "") || "user";
  const users = shopStates[shopId]?.users || [];
  let username = clean;
  let count = 2;
  while (users.some((user) => user.username.toLowerCase() === username)) {
    username = `${clean}.${count}`;
    count += 1;
  }
  return username;
}

function uniqueCustomerId(name) {
  const base = slugify(name || "customer");
  let id = base;
  let count = 2;
  while (customers.some((customer) => customer.id === id)) {
    id = `${base}-${count}`;
    count += 1;
  }
  return id;
}

function customerById(id) {
  return customers.find((customer) => customer.id === id) || customers[0] || { id: "walk-in-guest", name: "Walk-in Guest" };
}

function selectedCustomer() {
  return customerById(document.getElementById("saleCustomer")?.value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function authenticateLogin({ shopCode, username, password }) {
  const normalizedCode = shopCode.trim().toUpperCase();
  const normalizedUser = username.trim().toLowerCase();
  if (
    normalizedCode === platformAccount.shopCode &&
    normalizedUser === platformAccount.username &&
    password === platformAccount.password
  ) {
    return { ok: true, role: platformAccount.role, user: { ...platformAccount }, shopId: activeShopId };
  }

  const shop = shops.find((candidate) => (candidate.shopCode || "").toUpperCase() === normalizedCode && candidate.enabled !== false);
  if (!shop) return { ok: false };
  const shopState = shopStates[shop.id] || createShopState();
  shopStates[shop.id] = shopState;
  shopState.users = shopState.users?.length
    ? shopState.users
    : defaultShopUsers(shop.owner || "Owner", shop.ownerUsername || "owner");
  const user = shopState.users.find((candidate) =>
    candidate.active !== false &&
    Object.hasOwn(roleAccess, candidate.role) && candidate.role !== "Platform Admin" &&
    candidate.username.toLowerCase() === normalizedUser &&
    candidate.password === password
  );
  if (!user) return { ok: false };
  return { ok: true, role: user.role, user, shopId: shop.id };
}

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

function removeLegacyDemoRows() {
  // Preserve records: matching old demo values does not prove a row is disposable.
  inspectionRecords = inspectionRecords.map((record, index) => ({
    ...record,
    dueDate: record.dueDate || defaultState.inspectionRecords[index]?.dueDate || isoOffset(0),
    signedBy: record.evidence && !["Pending", "PDF missing"].includes(record.evidence) ? record.signedBy : "",
    signedAt: record.evidence && !["Pending", "PDF missing"].includes(record.evidence) ? record.signedAt || "" : "",
    evidence: ["Pending", "PDF missing"].includes(record.evidence) ? "" : record.evidence || ""
  }));
  documentChain = documentChain.map((document, index) => ({
    ...document,
    dueDate: document.dueDate || defaultState.documentChain[index]?.dueDate || isoOffset(30)
  }));
  ensureComplianceDocumentsForCountry();
  complianceDocuments = complianceDocuments.map((document) => ({
    ...document,
    holder: document.holder || "Shop",
    issueDate: document.issueDate || "",
    expiryDate: document.expiryDate || document.dueDate || isoOffset(30),
    renewalCost: Number(document.renewalCost || 0),
    evidence: document.evidence || "",
    reminderDays: Number(document.reminderDays || 30)
  }));
}

function saveState() {
  captureActiveShopState();
  const nextState = {
    shops,
    activeShopId,
    shopStates,
    services,
    purchases,
    expenses,
    sales,
    customers,
    queueTickets,
    appointments,
    auditLog,
    checklist,
    receiptEnabled,
    vatEnabled,
    openingCash,
    activeLanguage,
    inspectionRecords,
    hygieneLogs,
    complianceDocuments,
    documentChain,
    montajiItems,
    cashClosings,
    staffPayments
  };
  memoryState = nextState;
  try {
    localStorage.setItem(storageKey, JSON.stringify(nextState));
    scheduleCloudSave();
    return true;
  } catch {
    return false;
  }
}

document.querySelectorAll("[data-icon]").forEach((element) => {
  const icon = icons[element.dataset.icon];
  if (icon) element.innerHTML = icon;
});

const titles = {
  "master-admin": "Super Admin Console",
  dashboard: "Daily Control Dashboard",
  setup: "Launch Setup",
  "quick-sale": "Quick Sale",
  clients: "Clients & Queue",
  services: "Editable Service Catalog",
  purchases: "Purchases",
  expenses: "Expenses",
  inventory: "Inventory & Tools",
  compliance: "Compliance Control",
  cash: "Cash Closing",
  accounting: "Accounting Ledger",
  reports: "Reports",
  "launch-audit": "Launch Audit",
  settings: "Settings"
};

let activeViewId = "dashboard";

function translate(english) {
  if (activeLanguage === "en") return english;
  return uiTranslations[english]?.[activeLanguage] || english;
}

function translateTextNode(node) {
  const trimmed = node.nodeValue.trim();
  if (!trimmed) return;

  if (!textNodeOriginals.has(node)) {
    textNodeOriginals.set(node, uiTranslations[trimmed] ? trimmed : reverseTranslations[trimmed] || trimmed);
  }

  const original = textNodeOriginals.get(node);
  const nextText = translate(original);
  const leading = node.nodeValue.match(/^\s*/)[0];
  const trailing = node.nodeValue.match(/\s*$/)[0];
  node.nodeValue = `${leading}${nextText}${trailing}`;
}

function applyTranslations() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  nodes.forEach(translateTextNode);

  document.querySelectorAll("[placeholder]").forEach((element) => {
    const original = element.dataset.i18nPlaceholder || element.getAttribute("placeholder");
    element.dataset.i18nPlaceholder = original;
    element.setAttribute("placeholder", translate(original));
  });
}

function showView(viewId) {
  const allowed = roleAccess[currentRole] || roleAccess.Owner;
  if (!allowed.includes(viewId)) {
    viewId = allowed[0] || "quick-sale";
  }
  activeViewId = viewId;
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  document.querySelector(`[data-view="${viewId}"]`)?.classList.add("active");
  syncMobileViewSwitcher();
  if (viewId === "clients") renderClientsQueue();
  if (viewId === "accounting") renderAccounting();
  if (viewId === "launch-audit") renderLaunchAudit();
  document.getElementById("viewTitle").textContent = translate(titles[viewId] || "Salon Control");
  applyTranslations();
}

document.querySelectorAll(".nav-item").forEach((button) => {
  if (button.dataset.view) {
    button.addEventListener("click", () => showView(button.dataset.view));
  }
});

document.querySelectorAll("[data-jump]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.jump));
});

document.getElementById("shopSwitcher")?.addEventListener("change", (event) => {
  switchShop(event.target.value);
  renderMasterDashboard();
});

document.getElementById("mobileViewSwitcher")?.addEventListener("change", (event) => {
  showView(event.target.value);
});

document.getElementById("createShopBtn")?.addEventListener("click", createShopFromForm);
document.getElementById("createUserBtn")?.addEventListener("click", createUserFromForm);
document.getElementById("shopSearch")?.addEventListener("input", renderMasterDashboard);
document.getElementById("shopStatusFilter")?.addEventListener("change", renderMasterDashboard);
document.getElementById("saveCustomer")?.addEventListener("click", saveCustomerFromForm);
document.getElementById("saveBooking")?.addEventListener("click", saveBookingFromForm);
document.getElementById("runLaunchAudit")?.addEventListener("click", () => {
  renderLaunchAudit();
  addAudit("Stock adjusted", `${currentRole} · launch audit checked · ${new Date().toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}`);
});

function money(amount, shop = currentShop()) {
  const profile = currentCountryProfile(shop);
  return `${profile.currency} ${Number(amount || 0).toLocaleString(profile.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: profile.decimals
  })}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function csvRows(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadTextFile(filename, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportFilePrefix(kind) {
  const shop = currentShop();
  const code = shop?.shopCode || shop?.id || "shop";
  const date = new Date().toISOString().slice(0, 10);
  return `salon-control-${code}-${kind}-${date}`.toLowerCase();
}

function accountingExportRows() {
  const rows = [["Date", "Module", "Description", "Payment", "Debit", "Credit", "Staff", "Reference"]];
  sales.forEach((sale) => rows.push([
    sale.createdAt || "",
    "Sale",
    `${sale.customerName || "Walk-in"} · ${sale.service || (sale.services || []).join(" + ")}`,
    sale.payment || "",
    "",
    Number(sale.amount || 0).toFixed(2),
    sale.staff || "",
    sale.id || ""
  ]));
  purchases.forEach((purchase) => rows.push([
    purchase.createdAt || "",
    "Purchase",
    `${purchase.supplier || "Supplier"} · ${purchase.item || "Item"} · ${purchase.qty || 0} ${purchase.unit || ""}`.trim(),
    purchase.payment || "",
    purchaseTotal(purchase).toFixed(2),
    "",
    "",
    purchase.type || ""
  ]));
  expenses.forEach((expense) => rows.push([
    expense.createdAt || "",
    "Expense",
    `${expense.category || "Expense"} · ${expense.note || ""}`.trim(),
    expense.payment || "",
    Number(expense.amount || 0).toFixed(2),
    "",
    "",
    ""
  ]));
  cashClosings.forEach((closing) => rows.push([
    closing.createdAt || "",
    "Cash closing",
    closing.reason || "Daily close",
    "Cash",
    Number(closing.difference < 0 ? Math.abs(closing.difference) : 0).toFixed(2),
    Number(closing.difference > 0 ? closing.difference : 0).toFixed(2),
    closing.approvedBy || "",
    "closing"
  ]));
  return rows;
}

function stockMovementRows() {
  const rows = [["Date", "Type", "Item", "Qty", "Unit", "Unit cost", "Total", "Payment"]];
  purchases.forEach((purchase) => rows.push([
    purchase.createdAt || "",
    purchase.type || "Purchase",
    purchase.item || "",
    purchase.qty || 0,
    purchase.unit || "",
    Number(purchase.unitCost || 0).toFixed(2),
    purchaseTotal(purchase).toFixed(2),
    purchase.payment || ""
  ]));
  sales.forEach((sale) => {
    (sale.services || [sale.service]).forEach((service) => rows.push([
      sale.createdAt || "",
      "Service recipe",
      service || "",
      -1,
      "service",
      "",
      "",
      sale.payment || ""
    ]));
  });
  return rows;
}

function shortageRows() {
  const rows = [["Date", "Expected cash", "Actual cash", "Difference", "Reason", "Approved by"]];
  cashClosings.forEach((closing) => rows.push([
    closing.createdAt || "",
    Number(closing.expected || 0).toFixed(2),
    Number(closing.actual || 0).toFixed(2),
    Number(closing.difference || 0).toFixed(2),
    closing.reason || "",
    closing.approvedBy || ""
  ]));
  return rows;
}

function downloadDataExport(kind) {
  captureActiveShopState();
  if (kind === "daily") {
    window.print();
    return "Daily report opened for PDF save.";
  }
  if (kind === "backup") {
    const backup = {
      exportedAt: new Date().toISOString(),
      activeShopId,
      shops,
      shopStates,
      currentShop: currentShop()
    };
    downloadTextFile(`${exportFilePrefix("backup")}.json`, JSON.stringify(backup, null, 2), "application/json");
    return "Full JSON backup downloaded.";
  }
  const rowsByKind = {
    csv: accountingExportRows(),
    stock: stockMovementRows(),
    shortage: shortageRows()
  };
  const labels = {
    csv: "Accounting CSV downloaded.",
    stock: "Stock movement CSV downloaded.",
    shortage: "Cash shortage CSV downloaded."
  };
  downloadTextFile(`${exportFilePrefix(kind)}.csv`, csvRows(rowsByKind[kind] || accountingExportRows()), "text/csv");
  return labels[kind] || "Export downloaded.";
}

function numberValue(id) {
  return Math.max(Number(document.getElementById(id)?.value || 0), 0);
}

function todayLabel() {
  const locales = {
    en: "en-AE",
    ar: "ar-AE",
    hi: "hi-IN",
    ur: "ur-PK"
  };
  return new Intl.DateTimeFormat(locales[activeLanguage] || "en-AE", {
    weekday: "long",
    day: "2-digit",
    month: "short"
  }).format(new Date());
}

function addAudit(action, detail) {
  auditLog.unshift({ action, detail, createdAt: new Date().toISOString(), role: currentRole });
  auditLog = auditLog.slice(0, 50);
  saveState();
  renderAuditLog();
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
  const basket = document.getElementById("saleBasket");
  const selected = selectedSaleServices.filter((service) => service && service.active !== false);
  const total = selected.reduce((sum, service) => sum + (Number(service.price) || 0), 0);
  label.textContent = selected.length
    ? `${selected.length} services · ${money(total)}`
    : "No service selected";
  label.classList.toggle("rtl-preview", isRtlLanguage());
  if (basket) {
    basket.innerHTML = selected.length
      ? selected.map((service) => `<span>${escapeHtml(serviceName(service))} · ${money(service.price || 0)}</span>`).join("")
      : "<span>Tap one or more services to build the sale.</span>";
  }
}

function syncLanguageButtons() {
  document.querySelectorAll(".language-switch button").forEach((button) => {
    const language = button.dataset.lang || button.textContent.trim().toLowerCase();
    button.classList.toggle("active", language === activeLanguage);
  });
  document.body.classList.toggle("rtl-preview", isRtlLanguage());
  document.documentElement.lang = activeLanguage;
  document.documentElement.dir = isRtlLanguage() ? "rtl" : "ltr";
  document.getElementById("languageStatus").textContent = translate(`Language: ${languageLabels[activeLanguage] || "English"}`);
  document.getElementById("viewTitle").textContent = translate(titles[activeViewId] || "Salon Control");
  applyTranslations();
}

function syncReportTotals() {
  const latestClosing = cashClosings[0];
  const difference = latestClosing ? Number(latestClosing.difference) || 0 : 0;
  document.getElementById("reportSales").textContent = moneyFixed(totalSales());
  document.getElementById("reportCash").textContent = moneyFixed(expectedCashTotal());
  document.getElementById("reportCommission").textContent = moneyFixed(staffCommissionTotal());
  document.getElementById("reportDifference").textContent = moneyFixed(difference);
  document.getElementById("reportDifference").classList.toggle("negative", difference < 0);
  renderReportOutput();
}

function shopPurchaseTotal(shopState) {
  return (shopState.purchases || []).reduce((sum, purchase) => sum + purchaseTotal(purchase), 0);
}

function shopExpenseTotal(shopState) {
  return (shopState.expenses || []).reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
}

function shopSalesTotal(shopState) {
  return (shopState.sales || []).reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
}

function shopCashOutTotal(records) {
  return (records || []).reduce((sum, record) => record.payment === "Cash" ? sum + (purchaseTotal(record) || Number(record.amount) || 0) : sum, 0);
}

function shopExpectedCash(shopState) {
  const cashSales = (shopState.sales || []).reduce((sum, sale) => sale.payment === "Cash" ? sum + (Number(sale.amount) || 0) : sum, 0);
  return Number(shopState.openingCash || 0) + cashSales - shopCashOutTotal(shopState.purchases) - shopCashOutTotal(shopState.expenses);
}

function shopAttentionCount(shopState) {
  const complianceCount = (shopState.inspectionRecords || []).filter((record) => computedRecordStatus(record) !== "Ready").length;
  const expiryCount = (shopState.complianceDocuments || []).filter((documentItem) => computedExpiryStatus(documentItem) !== "Ready").length;
  const latestClosing = (shopState.cashClosings || [])[0];
  const cashFlag = latestClosing && Number(latestClosing.difference) !== 0 ? 1 : 0;
  const setupFlag = Object.values(shopState.checklist || {}).some((value) => !value) ? 1 : 0;
  return complianceCount + expiryCount + cashFlag + setupFlag;
}

function renderShopSwitcher() {
  const switcher = document.getElementById("shopSwitcher");
  if (!switcher) return;
  switcher.innerHTML = "";
  shops.filter((shop) => shop.enabled !== false).forEach((shop) => {
    const option = document.createElement("option");
    option.value = shop.id;
    option.textContent = `${shop.name} · ${shop.location}`;
    option.selected = shop.id === activeShopId;
    switcher.appendChild(option);
  });
  switcher.hidden = currentRole !== "Platform Admin";
}

function renderMobileViewSwitcher() {
  const switcher = document.getElementById("mobileViewSwitcher");
  if (!switcher) return;
  const allowed = roleAccess[currentRole] || roleAccess.Owner;
  const field = switcher.closest(".mobile-module-field");
  if (field) field.hidden = allowed.length <= 1;
  switcher.innerHTML = "";
  allowed.forEach((viewId) => {
    const option = document.createElement("option");
    option.value = viewId;
    option.textContent = translate(viewLabels[viewId] || titles[viewId] || viewId);
    option.selected = viewId === activeViewId;
    switcher.appendChild(option);
  });
}

function syncMobileViewSwitcher() {
  const switcher = document.getElementById("mobileViewSwitcher");
  if (!switcher) return;
  if (![...switcher.options].some((option) => option.value === activeViewId)) {
    renderMobileViewSwitcher();
  }
  switcher.value = activeViewId;
}

function renderMasterDashboard() {
  captureActiveShopState();
  const activeShops = shops.filter((shop) => shop.enabled !== false);
  const totals = activeShops.reduce((summary, shop) => {
    const shopState = shopStates[shop.id] || createShopState();
    summary.attention += shopAttentionCount(shopState);
    return summary;
  }, { attention: 0 });

  document.getElementById("masterExpectedCash").textContent = groupedMoneyForShops(activeShops, (shop) => shopExpectedCash(shopStates[shop.id] || createShopState()));
  document.getElementById("masterShopCount").textContent = String(activeShops.length);
  document.getElementById("masterShopNote").textContent = `${activeShops.length} active branches`;
  document.getElementById("masterSalesTotal").textContent = groupedMoneyForShops(activeShops, (shop) => shopSalesTotal(shopStates[shop.id] || createShopState()));
  document.getElementById("masterAttentionCount").textContent = String(totals.attention);

  const body = document.getElementById("masterShopTable");
  body.innerHTML = "";
  const search = (document.getElementById("shopSearch")?.value || "").trim().toLowerCase();
  const statusFilter = document.getElementById("shopStatusFilter")?.value || "active";
  const visibleShops = shops
    .filter((shop) => shop.deleted !== true)
    .filter((shop) => statusFilter === "all" || (statusFilter === "suspended" ? shop.enabled === false : shop.enabled !== false))
    .filter((shop) => {
      if (!search) return true;
      const profile = currentCountryProfile(shop);
      return [shop.name, shop.shopCode, shop.location, shop.owner, shop.ownerUsername, profile.name, profile.currency]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });

  if (!visibleShops.length) {
    body.innerHTML = `<tr><td colspan="8">No shops match this filter.</td></tr>`;
    return;
  }

  visibleShops.forEach((shop) => {
    const shopState = shopStates[shop.id] || createShopState();
    const profile = currentCountryProfile(shop);
    const attention = shopAttentionCount(shopState);
    const isSuspended = shop.enabled === false;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(shop.name)}</strong><br><span>${escapeHtml(shop.location)}</span></td>
      <td><code>${escapeHtml(shop.shopCode || "")}</code></td>
      <td>${escapeHtml(profile.name)}<br><small>${escapeHtml(profile.currency)}</small></td>
      <td>${escapeHtml(shop.owner || "Owner")}</td>
      <td>${moneyFixed(shopSalesTotal(shopState), shop)}</td>
      <td>${moneyFixed(shopExpectedCash(shopState), shop)}</td>
      <td><span class="status-pill ${isSuspended || attention ? "warning" : "ok"}">${isSuspended ? "Suspended" : attention ? `${attention} checks` : "Active"}</span></td>
      <td>
        <div class="action-cluster">
          <button class="mini-action" data-open-shop="${escapeHtml(shop.id)}" type="button" ${isSuspended ? "disabled" : ""}>Open</button>
          <button class="mini-action" data-reset-owner="${escapeHtml(shop.id)}" type="button">Reset</button>
          <button class="mini-action" data-toggle-shop="${escapeHtml(shop.id)}" type="button">${isSuspended ? "Restore" : "Suspend"}</button>
          <button class="danger-button" data-delete-shop="${escapeHtml(shop.id)}" type="button">Delete</button>
        </div>
      </td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-open-shop]").forEach((button) => {
    button.addEventListener("click", () => {
      switchShop(button.dataset.openShop);
      showView("dashboard");
    });
  });
  body.querySelectorAll("[data-reset-owner]").forEach((button) => {
    button.addEventListener("click", () => resetOwnerPassword(button.dataset.resetOwner));
  });
  body.querySelectorAll("[data-toggle-shop]").forEach((button) => {
    button.addEventListener("click", () => toggleShopStatus(button.dataset.toggleShop));
  });
  body.querySelectorAll("[data-delete-shop]").forEach((button) => {
    button.addEventListener("click", () => deleteShop(button.dataset.deleteShop));
  });
}

function syncShopIdentity() {
  const shop = currentShop();
  document.getElementById("userChip").textContent = currentRole === "Platform Admin"
    ? "Platform Admin · Network"
    : `${translate(currentRole)} · ${currentUser.name || currentUser.username || shop?.location || "Shop"}`;
  if (!shop) return;
  const profile = currentCountryProfile(shop);
  document.querySelectorAll(".branch-card strong").forEach((element) => {
    element.textContent = shop.name;
  });
  const businessCard = document.querySelector("#setup .setup-card strong + small");
  if (businessCard) businessCard.textContent = `${shop.name} Barber`;
  const setupCountryLabel = document.getElementById("setupCountryLabel");
  if (setupCountryLabel) setupCountryLabel.textContent = `${profile.name} · ${profile.currency} currency · ${vatEnabled ? "VAT on" : "VAT optional"}`;
  const reportSubtitle = document.querySelector(".report-header p");
  if (reportSubtitle) reportSubtitle.textContent = `${shop.name} · ${todayLabel()} · ${vatEnabled ? "VAT records" : "non-VAT internal records"}`;
  const countrySelect = document.getElementById("countrySelect");
  if (countrySelect) countrySelect.value = shop.country || currencyToCountry[shop.currency] || "AE";
  renderShopSwitcher();
  renderUserManagement();
}

function syncDashboardTotals() {
  const serviceCount = totalServiceItemsSold();
  document.getElementById("todaySales").textContent = moneyFixed(totalSales());
  document.getElementById("expectedCash").textContent = moneyFixed(expectedCashTotal());
  document.getElementById("salesCardNote").textContent = activeLanguage === "en"
    ? `${serviceCount} services · ${purchases.length} purchase records · no VAT added`
    : `${serviceCount} · ${translate("Services")} · ${purchases.length} · ${translate("Purchases")}`;
  renderOwnerChecks();
  syncShopIdentity();
  renderMasterDashboard();
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

function totalSales() {
  return sales.reduce((sum, sale) => sum + (Number(sale.amount) || 0), 0);
}

function totalServiceItemsSold() {
  return sales.reduce((sum, sale) => sum + (Array.isArray(sale.services) ? sale.services.length : 1), 0);
}

function cashSalesTotal() {
  return sales.reduce((sum, sale) => sale.payment === "Cash" ? sum + (Number(sale.amount) || 0) : sum, 0);
}

function expectedCashTotal() {
  return openingCash + cashSalesTotal() - cashOutTotal(purchases) - cashOutTotal(expenses);
}

function staffCommissionTotal() {
  return totalSales() * 0.12;
}

function cashOutTotal(records) {
  return records.reduce((sum, record) => record.payment === "Cash" ? sum + (purchaseTotal(record) || Number(record.amount) || 0) : sum, 0);
}

function paymentAccount(payment) {
  return payment === "Cash" ? "1000 Cash on hand" : "1010 Bank / card clearing";
}

function purchaseDebitAccount(purchase) {
  if (purchase.type === "Reusable tool / asset") return "1500 Reusable tools and equipment";
  if (purchase.type === "Operational supply") return "6100 Shop operating expenses";
  return "1200 Inventory and supplies";
}

function journalLine(date, account, description, debit = 0, credit = 0, source = "") {
  return { date, account, description, debit: Number(debit) || 0, credit: Number(credit) || 0, source };
}

function journalEntries() {
  const entries = [];
  if (openingCash) {
    entries.push(journalLine("Opening", "1000 Cash on hand", "Opening cash float", openingCash, 0, "opening"));
    entries.push(journalLine("Opening", "3000 Owner capital", "Opening cash float", 0, openingCash, "opening"));
  }
  sales.forEach((sale) => {
    const amount = Number(sale.amount) || 0;
    const date = sale.createdAt || "";
    const description = `${sale.customerName || "Walk-in"} · ${sale.service || (sale.services || []).join(" + ")} · ${sale.staff || "Staff"}`;
    entries.push(journalLine(date, paymentAccount(sale.payment), description, amount, 0, "sale"));
    entries.push(journalLine(date, "4000 Service revenue", description, 0, amount, "sale"));
    const commission = amount * 0.12;
    if (commission) {
      entries.push(journalLine(date, "6300 Staff commission expense", description, commission, 0, "commission"));
      entries.push(journalLine(date, "7000 Staff commission payable", description, 0, commission, "commission"));
    }
  });
  purchases.forEach((purchase) => {
    const amount = purchaseTotal(purchase);
    const date = purchase.createdAt || "";
    const description = `${purchase.supplier || "Supplier"} · ${purchase.item || "Purchase"}`;
    entries.push(journalLine(date, purchaseDebitAccount(purchase), description, amount, 0, "purchase"));
    entries.push(journalLine(date, paymentAccount(purchase.payment), description, 0, amount, "purchase"));
  });
  expenses.forEach((expense) => {
    const amount = Number(expense.amount) || 0;
    const date = expense.createdAt || "";
    const description = `${expense.category || "Expense"} · ${expense.note || ""}`.trim();
    entries.push(journalLine(date, "6100 Shop operating expenses", description, amount, 0, "expense"));
    entries.push(journalLine(date, paymentAccount(expense.payment), description, 0, amount, "expense"));
  });
  cashClosings.forEach((closing) => {
    const difference = Number(closing.difference) || 0;
    if (!difference) return;
    const description = closing.reason || "Cash closing difference";
    if (difference < 0) {
      entries.push(journalLine(closing.createdAt || "", "6200 Cash shortage / overage", description, Math.abs(difference), 0, "cash-close"));
      entries.push(journalLine(closing.createdAt || "", "1000 Cash on hand", description, 0, Math.abs(difference), "cash-close"));
    } else {
      entries.push(journalLine(closing.createdAt || "", "1000 Cash on hand", description, difference, 0, "cash-close"));
      entries.push(journalLine(closing.createdAt || "", "6200 Cash shortage / overage", description, 0, difference, "cash-close"));
    }
  });
  return entries;
}

function trialBalanceRows() {
  const balances = new Map();
  journalEntries().forEach((entry) => {
    const current = balances.get(entry.account) || { account: entry.account, debit: 0, credit: 0 };
    current.debit += entry.debit;
    current.credit += entry.credit;
    balances.set(entry.account, current);
  });
  return [...balances.values()].filter((row) => row.debit || row.credit);
}

function syncSummaryTotals() {
  const purchaseText = moneyFixed(totalPurchases());
  const expenseText = moneyFixed(totalExpenses());
  document.getElementById("loginPurchasesTotal").textContent = purchaseText;
  document.getElementById("loginExpensesTotal").textContent = expenseText;
  document.getElementById("dashboardPurchasesTotal").textContent = purchaseText;
  document.getElementById("dashboardExpensesTotal").textContent = expenseText;
  document.getElementById("reportPurchases").textContent = purchaseText;
  document.getElementById("reportExpenses").textContent = expenseText;
  syncDashboardTotals();
  syncReportTotals();
  renderClientsQueue();
  renderAccounting();
  renderLaunchAudit();
  updateClosingCalculation();
}

function moneyFixed(amount, shop = currentShop()) {
  const profile = currentCountryProfile(shop);
  return `${profile.currency} ${Number(amount || 0).toLocaleString(profile.locale, {
    minimumFractionDigits: profile.decimals,
    maximumFractionDigits: profile.decimals
  })}`;
}

function formatMoneyForProfile(amount, profile) {
  return `${profile.currency} ${Number(amount || 0).toLocaleString(profile.locale, {
    minimumFractionDigits: profile.decimals,
    maximumFractionDigits: profile.decimals
  })}`;
}

function groupedMoneyForShops(sourceShops, selector) {
  const groups = sourceShops.reduce((totals, shop) => {
    const profile = currentCountryProfile(shop);
    totals[profile.currency] = totals[profile.currency] || { total: 0, profile };
    totals[profile.currency].total += Number(selector(shop) || 0);
    return totals;
  }, {});
  const values = Object.values(groups);
  if (!values.length) return moneyFixed(0);
  return values.map((group) => formatMoneyForProfile(group.total, group.profile)).join(" · ");
}

function updateClosingCalculation() {
  openingCash = numberValue("closingOpeningCash");
  document.getElementById("closingCashSales").value = cashSalesTotal().toFixed(2);
  document.getElementById("closingCashExpenses").value = cashOutTotal(expenses).toFixed(2);
  document.getElementById("closingCashPurchases").value = cashOutTotal(purchases).toFixed(2);
  const expected = expectedCashTotal();
  const difference = numberValue("closingActualCash") - expected;
  document.getElementById("closingExpectedCash").textContent = moneyFixed(expected);
  document.getElementById("closingDifference").textContent = moneyFixed(difference);
  document.getElementById("closingDifference").classList.toggle("negative", difference < 0);
}

function renderAuditLog() {
  const container = document.getElementById("auditList");
  if (!container) return;
  container.innerHTML = "";
  auditLog.slice(0, 8).forEach((entry) => {
    const row = document.createElement("div");
    const stamp = new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.createdAt));
    const action = document.createElement("strong");
    const detail = document.createElement("span");
    action.textContent = translate(entry.action);
    detail.textContent = `${entry.detail} · ${stamp}`;
    row.append(action, detail);
    container.appendChild(row);
  });
  applyTranslations();
}

function statusClass(status) {
  if (["Overdue", "Expired", "Unknown", "Missing"].includes(status)) return "danger";
  if (["DueSoon", "Needs ref", "EvidenceMissing"].includes(status)) return "warning";
  return "ok";
}

function daysUntil(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function dateLabel(dateString) {
  if (!dateString) return translate("Pending");
  if (dateString === "Opening") return "Opening";
  const value = String(dateString);
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const locales = { en: "en-AE", ar: "ar-AE", hi: "hi-IN", ur: "ur-PK" };
  return new Intl.DateTimeFormat(locales[activeLanguage] || "en-AE", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(date);
}

function computedRecordStatus(record) {
  if ((record.evidence || record.evidenceFile) && record.signedAt) return "Ready";
  const days = daysUntil(record.dueDate);
  if (days < 0) return "Overdue";
  if (days <= 7) return "DueSoon";
  return "Ready";
}

function computedExpiryStatus(document) {
  if (!document.expiryDate) return "Missing";
  const days = daysUntil(document.expiryDate);
  if (days < 0) return "Expired";
  if (days <= Number(document.reminderDays || 30)) return "DueSoon";
  if (!document.evidence && !document.evidenceFile) return "EvidenceMissing";
  return "Ready";
}

function fileSizeLabel(bytes = 0) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function evidenceLabel(record) {
  if (record.evidenceFile?.name) return `${record.evidenceFile.name} · ${fileSizeLabel(record.evidenceFile.size)}`;
  return record.evidence || "Pending";
}

function evidenceMarkup(record) {
  if (record.evidenceFile?.dataUrl) {
    return `<a class="evidence-link" href="${record.evidenceFile.dataUrl}" target="_blank" rel="noopener">${escapeHtml(evidenceLabel(record))}</a>`;
  }
  return escapeHtml(evidenceLabel(record));
}

async function readEvidenceFile(inputId) {
  const input = document.getElementById(inputId);
  const file = input?.files?.[0];
  if (!file) return null;
  const allowed = file.type.startsWith("image/") || file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!allowed) return Promise.reject(new Error("Only PDF or image files can be uploaded."));
  if (file.size > 10 * 1024 * 1024) throw new Error("Upload must be 10 MB or smaller.");
  if (!isLocalDemo) return window.SalonBackend.uploadEvidence(cloudTargetShopId(), file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File upload could not be read."));
    reader.onload = () => resolve({
      name: file.name,
      type: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
      size: file.size,
      uploadedAt: new Date().toISOString(),
      dataUrl: reader.result
    });
    reader.readAsDataURL(file);
  });
}

function ensureComplianceDocumentsForCountry() {
  const requiredDocs = defaultComplianceDocuments(currentShop()?.country || "AE");
  complianceDocuments = Array.isArray(complianceDocuments) ? complianceDocuments : [];
  const currentNames = new Set(requiredDocs.map((documentItem) => documentItem.type));
  const countrySpecificNames = new Set(
    Object.values(countryProfiles).flatMap((profile) => [profile.tenancyName, profile.healthName])
  );
  complianceDocuments = complianceDocuments.filter((documentItem) => {
    if (!countrySpecificNames.has(documentItem.type) || currentNames.has(documentItem.type)) return true;
    return !!(documentItem.number || documentItem.evidence || Number(documentItem.renewalCost || 0));
  });
  requiredDocs.forEach((required) => {
    if (!complianceDocuments.some((document) => document.type === required.type)) {
      complianceDocuments.push(required);
    }
  });
}

function expiryStatusLabel(status) {
  return {
    Missing: "Missing date",
    Expired: "Expired",
    DueSoon: "Expiring soon",
    EvidenceMissing: "Evidence missing",
    Ready: "Valid"
  }[status] || status;
}

function renderInspectionRecords() {
  const body = document.getElementById("inspectionRecordTable");
  if (!body) return;
  body.innerHTML = "";

  inspectionRecords.forEach((record, index) => {
    const status = computedRecordStatus(record);
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(translate(record.record))}</strong></td>
      <td>${escapeHtml(translate(record.cadence))}</td>
      <td>${escapeHtml(dateLabel(record.dueDate))}</td>
      <td>${escapeHtml(record.signedBy ? translate(record.signedBy) : translate("Pending"))}</td>
      <td>
        <input class="inline-evidence" data-evidence-input="${index}" value="${escapeHtml(record.evidence || "")}" placeholder="${escapeHtml(translate("Evidence required"))}" />
        <input class="inline-file" data-evidence-file="${index}" type="file" accept="image/*,.pdf,application/pdf" />
        <small>${evidenceMarkup(record)}</small>
      </td>
      <td><span class="status-pill ${statusClass(status)}">${escapeHtml(translate(status))}</span></td>
      <td><button class="mini-action" data-sign-record="${index}" type="button">${translate("Mark signed")}</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-sign-record]").forEach((button) => {
    button.addEventListener("click", async () => {
      const record = inspectionRecords[Number(button.dataset.signRecord)];
      if (!record) return;
      const evidence = document.querySelector(`[data-evidence-input="${button.dataset.signRecord}"]`)?.value.trim();
      let evidenceFile = null;
      try {
        const fileInput = document.querySelector(`[data-evidence-file="${button.dataset.signRecord}"]`);
        if (fileInput?.files?.[0]) {
          const syntheticId = `inspectionEvidenceFile${button.dataset.signRecord}`;
          fileInput.id = syntheticId;
          evidenceFile = await readEvidenceFile(syntheticId);
        }
      } catch (error) {
        document.getElementById("inspectionNote").textContent = error.message;
        return;
      }
      if (!evidence && !evidenceFile && !record.evidenceFile) {
        document.getElementById("inspectionNote").textContent = translate("Evidence required before signing.");
        return;
      }
      record.signedBy = currentRole;
      record.evidence = evidence || record.evidence || evidenceFile?.name || "";
      if (evidenceFile) record.evidenceFile = evidenceFile;
      record.signedAt = new Date().toISOString();
      addAudit("Stock adjusted", `${currentRole} · inspection signed · ${record.record}`);
      saveState();
      renderCompliance();
      document.getElementById("inspectionNote").textContent = translate("Inspection signed with evidence.");
    });
  });
}

function renderDocumentChain() {
  const container = document.getElementById("documentChain");
  if (!container) return;
  container.innerHTML = "";
  documentChain.forEach((docItem, index) => {
    const status = computedRecordStatus(docItem);
    const item = document.createElement("div");
    item.className = statusClass(status);
    item.innerHTML = `
      <span>${index + 1}</span>
      <div><strong>${escapeHtml(translate(docItem.name))}</strong><small>${escapeHtml(translate("Due"))}: ${escapeHtml(dateLabel(docItem.dueDate))}</small></div>
      <b>${escapeHtml(translate(status))}</b>
    `;
    container.appendChild(item);
  });
}

function expiryOptionsForCountry() {
  const profile = currentCountryProfile();
  return [profile.tenancyName, profile.healthName, ...baseExpiryTypes]
    .filter((value, index, list) => list.indexOf(value) === index);
}

function renderExpiryTypeOptions() {
  const select = document.getElementById("expiryType");
  if (!select) return;
  const current = select.value;
  select.innerHTML = expiryOptionsForCountry().map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function renderExpiryDocuments() {
  const body = document.getElementById("expiryDocumentTable");
  if (!body) return;
  renderExpiryTypeOptions();
  const profile = currentCountryProfile();
  document.getElementById("expiryCountryNote").textContent = `${profile.name} profile · ${profile.currency} renewal costs · ${profile.healthName}`;
  const openCount = complianceDocuments.filter((expiryDocument) => computedExpiryStatus(expiryDocument) !== "Ready").length;
  document.getElementById("expiryOpenCount").textContent = `${openCount} expiring`;
  body.innerHTML = "";
  complianceDocuments
    .slice()
    .sort((first, second) => daysUntil(first.expiryDate) - daysUntil(second.expiryDate))
    .forEach((expiryDocument) => {
      const originalIndex = complianceDocuments.indexOf(expiryDocument);
      const status = computedExpiryStatus(expiryDocument);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeHtml(expiryDocument.type)}</strong><br><small>Reminder ${escapeHtml(expiryDocument.reminderDays || 30)} days before</small></td>
        <td>${escapeHtml(expiryDocument.holder || "Shop")}</td>
        <td>${escapeHtml(expiryDocument.number || "Pending")}</td>
        <td>${escapeHtml(dateLabel(expiryDocument.expiryDate))}</td>
        <td>${moneyFixed(expiryDocument.renewalCost || 0)}</td>
        <td>${evidenceMarkup(expiryDocument)}</td>
        <td><span class="status-pill ${statusClass(status)}">${escapeHtml(expiryStatusLabel(status))}</span></td>
        <td><button class="mini-action danger" data-delete-expiry="${originalIndex}" type="button">Delete</button></td>
      `;
      body.appendChild(row);
    });

  body.querySelectorAll("[data-delete-expiry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.deleteExpiry);
      if (!window.confirm("Delete this expiry record? The audit history will be retained.")) return;
      if (!await deleteCloudRecord(complianceDocuments[index], "compliance_document", index)) return;
      const removed = complianceDocuments.splice(index, 1)[0];
      addAudit("Stock adjusted", `${currentRole} · expiry deleted · ${removed?.type || "document"}`);
      saveState();
      renderCompliance();
      document.getElementById("expiryNote").textContent = "Expiry record deleted.";
    });
  });
}

function renderHygieneLogs() {
  const body = document.getElementById("hygieneLogTable");
  if (!body) return;
  body.innerHTML = "";
  hygieneLogs.slice(0, 8).forEach((log) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(log.time)}</td>
      <td>${escapeHtml(translate(log.device))}</td>
      <td>${escapeHtml(translate(log.operator))}</td>
      <td>${escapeHtml(translate(log.cycle))}</td>
      <td>${escapeHtml(translate(log.solution || "Pending"))}</td>
      <td>${escapeHtml(translate(log.singleUse))}</td>
      <td>${evidenceMarkup(log)}</td>
      <td><span class="status-pill ${statusClass(log.status)}">${escapeHtml(translate(log.status))}</span></td>
    `;
    body.appendChild(row);
  });
}

function renderMontajiItems() {
  const body = document.getElementById("montajiTable");
  if (!body) return;
  body.innerHTML = "";
  montajiItems.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(translate(item.sku))}</td>
      <td><span class="status-pill ${statusClass(item.status)}">${escapeHtml(translate(item.status))}</span></td>
      <td>${escapeHtml(translate(item.action))}</td>
    `;
    body.appendChild(row);
  });
}

function syncComplianceMetrics() {
  const notReadyRecords = inspectionRecords.filter((record) => computedRecordStatus(record) !== "Ready").length;
  const documentProblems = documentChain.filter((document) => computedRecordStatus(document) !== "Ready").length;
  const expiryProblems = complianceDocuments.filter((document) => computedExpiryStatus(document) !== "Ready").length;
  const montajiProblems = montajiItems.filter((item) => item.status !== "Registered").length;
  const readiness = Math.max(0, Math.round(100 - ((notReadyRecords + documentProblems + expiryProblems + montajiProblems) * 7)));
  const paidStaff = staffPayments.filter((staff) => staff.paidAt).length;
  const staffTotal = Math.max(staffPayments.length, 1);
  const paidPercent = Math.round((paidStaff / staffTotal) * 100);
  const wpsDay = new Date().getDate();
  document.getElementById("inspectionReadiness").textContent = `${readiness}%`;
  document.getElementById("overdueRecordCount").textContent = String(notReadyRecords + documentProblems + expiryProblems);
  document.getElementById("wpsMetric").textContent = activeLanguage === "en" ? `Day ${wpsDay}` : `${translate("Day 2").replace("2", wpsDay)}`;
  document.getElementById("montajiMetric").textContent = String(montajiProblems);
  document.getElementById("wpsDetail").textContent = activeLanguage === "en"
    ? `Wage cycle day ${wpsDay} · ${paidStaff} of ${staffTotal} staff paid · ${paidPercent < 85 ? "WPS below 85%" : "WPS on track"}`
    : `${paidStaff}/${staffTotal} · ${paidPercent}% · ${translate(paidPercent < 85 ? "WPS below 85%" : "WPS on track")}`;
}

function renderCompliance() {
  renderInspectionRecords();
  renderDocumentChain();
  renderExpiryDocuments();
  renderHygieneLogs();
  renderMontajiItems();
  syncComplianceMetrics();
  renderOwnerChecks();
  applyTranslations();
}

function applySelectedCountryProfile() {
  const shop = currentShop();
  const select = document.getElementById("countrySelect");
  if (!shop || !select) return;
  const country = select.value || "AE";
  const profile = countryProfiles[country] || countryProfiles.AE;
  shop.country = country;
  shop.currency = profile.currency;
  ensureComplianceDocumentsForCountry();
  syncShopIdentity();
  renderPurchaseTable();
  renderExpenseTable();
  renderServiceTable();
  renderSaleServices();
  renderClientsQueue();
  syncSelectedServiceLabel();
  renderCompliance();
  syncSummaryTotals();
}

function renderOwnerChecks() {
  const container = document.getElementById("ownerCheckList");
  if (!container) return;
  const latestClosing = cashClosings[0];
  const checks = [];
  if (latestClosing && Number(latestClosing.difference) !== 0) {
    checks.push({
      level: Number(latestClosing.difference) < 0 ? "danger" : "warning",
      title: "Cash shortage pending",
      detail: `${translate("Cash expected")} ${moneyFixed(latestClosing.expected)} · ${translate("Actual cash counted")} ${moneyFixed(latestClosing.actual)}`,
      action: moneyFixed(latestClosing.difference)
    });
  }
  const missingInspection = inspectionRecords.filter((record) => computedRecordStatus(record) !== "Ready").length;
  if (missingInspection) {
    checks.push({
      level: "warning",
      title: "Inspection Binder",
      detail: `${missingInspection} ${translate("Overdue records")}`,
      action: "Review"
    });
  }
  const expiringDocuments = complianceDocuments.filter((document) => computedExpiryStatus(document) !== "Ready").length;
  if (expiringDocuments) {
    checks.push({
      level: "danger",
      title: "Document expiries",
      detail: `${expiringDocuments} lease, licence, visa, health or pest control records need action`,
      action: "Renew"
    });
  }
  const montajiProblems = montajiItems.filter((item) => item.status !== "Registered").length;
  if (montajiProblems) {
    checks.push({
      level: "warning",
      title: "Montaji watch",
      detail: `${montajiProblems} ${translate("Product registration warning")}`,
      action: "Check"
    });
  }
  if (!checks.length) {
    checks.push({
      level: "",
      title: "No records yet",
      detail: "Start with Quick Sale, Purchases and Expenses.",
      action: "Ready"
    });
  }
  container.innerHTML = "";
  checks.slice(0, 4).forEach((check) => {
    const row = document.createElement("div");
    row.className = `check-row ${check.level}`.trim();
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(translate(check.title))}</strong>
        <span>${escapeHtml(translate(check.detail))}</span>
      </div>
      <b>${escapeHtml(translate(check.action))}</b>
    `;
    container.appendChild(row);
  });
}

function renderReportOutput() {
  const body = document.getElementById("reportOutputTable");
  if (!body) return;
  const latestClosing = cashClosings[0];
  const rows = [
    ["Sales", `${totalServiceItemsSold()} ${translate("Services")} · ${moneyFixed(totalSales())}`, sales.length ? "Approved" : "No records yet"],
    ["Purchases", `${purchases.length} ${translate("Purchases")} · ${moneyFixed(totalPurchases())}`, purchases.length ? "Stock updated" : "No records yet"],
    ["Expenses", `${expenses.length} ${translate("Expenses")} · ${moneyFixed(totalExpenses())}`, expenses.length ? "Approved" : "No records yet"],
    ["Cash", latestClosing ? `${translate("Cash difference")} ${moneyFixed(latestClosing.difference)}` : "No records yet", latestClosing ? "Approved" : "Reason required"],
    ["Audit", `${auditLog.length} ${translate("Audit")}`, "No silent edits"]
  ];
  body.innerHTML = "";
  rows.forEach(([section, result, action]) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(translate(section))}</td>
      <td>${escapeHtml(translate(result))}</td>
      <td>${escapeHtml(translate(action))}</td>
    `;
    body.appendChild(row);
  });
}

function renderAccounting() {
  const journalBody = document.getElementById("accountingJournalTable");
  const chartBody = document.getElementById("accountingChartTable");
  const trialBody = document.getElementById("accountingTrialTable");
  if (!journalBody || !chartBody || !trialBody) return;

  const entries = journalEntries();
  const shortageTotal = cashClosings.reduce((sum, closing) => sum + Math.abs(Number(closing.difference) || 0), 0);
  const costTotal = totalPurchases() + totalExpenses() + shortageTotal + staffCommissionTotal();
  document.getElementById("accountingCashBalance").textContent = moneyFixed(expectedCashTotal());
  document.getElementById("accountingRevenue").textContent = moneyFixed(totalSales());
  document.getElementById("accountingCosts").textContent = moneyFixed(costTotal);
  document.getElementById("accountingResult").textContent = moneyFixed(totalSales() - costTotal);

  chartBody.innerHTML = "";
  chartOfAccounts.forEach((account) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><code>${escapeHtml(account.code)}</code></td>
      <td>${escapeHtml(account.name)}</td>
      <td>${escapeHtml(account.type)}</td>
    `;
    chartBody.appendChild(row);
  });

  journalBody.innerHTML = "";
  const visibleEntries = entries.slice(-28).reverse();
  if (!visibleEntries.length) {
    journalBody.innerHTML = `<tr><td colspan="5">No accounting entries yet. Save a sale, purchase or expense first.</td></tr>`;
  } else {
    visibleEntries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(entry.date === "Opening" ? "Opening" : dateLabel(entry.date))}</td>
        <td>${escapeHtml(entry.account)}</td>
        <td>${escapeHtml(entry.description)}</td>
        <td>${entry.debit ? moneyFixed(entry.debit) : "-"}</td>
        <td>${entry.credit ? moneyFixed(entry.credit) : "-"}</td>
      `;
      journalBody.appendChild(row);
    });
  }

  const trialRows = trialBalanceRows();
  const totalDebit = trialRows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = trialRows.reduce((sum, row) => sum + row.credit, 0);
  trialBody.innerHTML = "";
  trialRows.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(entry.account)}</td>
      <td>${entry.debit ? moneyFixed(entry.debit) : "-"}</td>
      <td>${entry.credit ? moneyFixed(entry.credit) : "-"}</td>
    `;
    trialBody.appendChild(row);
  });
  const totalRow = document.createElement("tr");
  totalRow.className = "trial-total-row";
  totalRow.innerHTML = `
    <td>Total</td>
    <td>${moneyFixed(totalDebit)}</td>
    <td>${moneyFixed(totalCredit)}</td>
  `;
  trialBody.appendChild(totalRow);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const status = document.getElementById("trialBalanceStatus");
  status.textContent = balanced ? "Balanced" : "Review needed";
  status.className = `status-pill ${balanced ? "ok" : "danger"}`;
}

function launchAuditSnapshot() {
  return launchAuditItems.map((item) => {
    let passed = false;
    try {
      passed = Boolean(item.test());
    } catch {
      passed = false;
    }
    const backendRequired = ["accounting", "backend", "files", "security", "exports"].includes(item.id);
    return {
      ...item,
      passed,
      status: passed ? "Working" : backendRequired ? "Backend required" : "Needs build"
    };
  });
}

function renderLaunchAudit() {
  const list = document.getElementById("launchAuditList");
  const priorityStack = document.getElementById("launchPriorityStack");
  const requirementGrid = document.getElementById("productionRequirementGrid");
  if (!list || !priorityStack || !requirementGrid) return;

  const snapshot = launchAuditSnapshot();
  const completed = snapshot.filter((item) => item.passed).length;
  const backendGaps = snapshot.filter((item) => item.status === "Backend required").length;
  const nextSprint = snapshot.filter((item) => !item.passed && item.priority === "P0").length;
  const score = Math.round((completed / snapshot.length) * 100);

  document.getElementById("auditReadinessScore").textContent = `${score}%`;
  document.getElementById("auditWorkingCount").textContent = `${completed}/${snapshot.length}`;
  document.getElementById("auditBackendCount").textContent = String(backendGaps);
  document.getElementById("auditNextSprintCount").textContent = String(nextSprint);

  list.innerHTML = "";
  snapshot.forEach((item) => {
    const row = document.createElement("div");
    row.className = `launch-audit-row ${item.passed ? "pass" : item.status === "Backend required" ? "blocked" : "todo"}`;
    row.innerHTML = `
      <div class="audit-status-dot" aria-hidden="true"></div>
      <div>
        <span>${escapeHtml(item.area)} · ${escapeHtml(item.priority)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.marketReason)}</small>
        <em>${escapeHtml(item.next)}</em>
      </div>
      <b>${escapeHtml(item.status)}</b>
    `;
    list.appendChild(row);
  });

  priorityStack.innerHTML = "";
  snapshot
    .filter((item) => !item.passed)
    .sort((a, b) => a.priority.localeCompare(b.priority))
    .slice(0, 8)
    .forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "priority-card";
      card.innerHTML = `
        <span>${index + 1}</span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${escapeHtml(item.next)}</small>
        </div>
      `;
      priorityStack.appendChild(card);
    });

  requirementGrid.innerHTML = "";
  productionRequirements.forEach(([title, detail]) => {
    const card = document.createElement("div");
    card.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(detail)}</span>`;
    requirementGrid.appendChild(card);
  });
}

function syncChecklist() {
  document.querySelectorAll("[data-checklist]").forEach((input) => {
    input.checked = !!checklist[input.dataset.checklist];
  });
}

function applyRoleAccess() {
  const allowed = roleAccess[currentRole] || roleAccess.Owner;
  document.querySelectorAll("#appShell .nav-item[data-view]").forEach((item) => {
    const enabled = allowed.includes(item.dataset.view);
    item.hidden = !enabled;
    item.disabled = !enabled;
  });
  document.querySelectorAll(".shop-only-control").forEach((item) => {
    item.hidden = false;
  });
  document.body.classList.remove("is-platform-admin");
  renderShopSwitcher();
  renderMobileViewSwitcher();
}

async function switchShop(shopId) {
  if (!shops.some((shop) => shop.id === shopId && shop.enabled !== false)) return;
  captureActiveShopState();
  activeShopId = shopId;
  if (!isLocalDemo) {
    setSyncStatus("Loading…", "saving");
    try {
      await Promise.all([loadCloudShopState(shopId), loadCloudUsers(shopId)]);
      setSyncStatus("Cloud connected", "connected");
    } catch (error) {
      console.error("Cloud shop load failed", error);
      setSyncStatus("Load failed", "error");
      return;
    }
  }
  hydrateActiveShop();
  removeLegacyDemoRows();
  migrateServices();
  document.getElementById("closingOpeningCash").value = openingCash.toFixed(2);
  renderSaleServices();
  renderClientsQueue();
  renderServiceTable();
  renderPurchaseTable();
  renderExpenseTable();
  renderCompliance();
  renderAuditLog();
  syncChecklist();
  syncSelectedServiceLabel();
  syncSummaryTotals();
  syncTaxSettings();
  updatePurchaseCalculation();
  saveState();
}

async function createShopFromForm() {
  const name = document.getElementById("newShopName").value.trim();
  const requestedCode = document.getElementById("newShopCode").value.trim().toUpperCase();
  const shopCode = requestedCode || (isLocalDemo ? shopCodeFromName(name) : "");
  const location = document.getElementById("newShopLocation").value.trim() || "New branch";
  const owner = document.getElementById("newShopOwner").value.trim() || "Owner";
  const ownerUsername = document.getElementById("newOwnerUsername").value.trim() || (isLocalDemo ? uniqueUsername(`${owner}.${name}`) : "");
  const ownerPassword = document.getElementById("newOwnerPassword").value;
  const opening = Number(document.getElementById("newShopOpeningCash").value || 0);
  const language = document.getElementById("newShopLanguage").value;
  const country = document.getElementById("newShopCountry").value || "AE";
  const profile = countryProfiles[country] || countryProfiles.AE;
  const vat = document.getElementById("newShopVat").value === "on";
  const note = document.getElementById("masterNote");

  if (!name || !shopCode || !ownerUsername || !ownerPassword) {
    note.textContent = "Shop name, Shop ID, owner username and password are required.";
    document.getElementById("newShopName").focus();
    return;
  }
  if (ownerPassword.length < 10) {
    note.textContent = "Owner password must be at least 10 characters.";
    document.getElementById("newOwnerPassword").focus();
    return;
  }

  captureActiveShopState();
  if (shops.some((shop) => (shop.shopCode || "").toUpperCase() === shopCode)) {
    note.textContent = "Shop ID already exists. Use a unique shop ID.";
    document.getElementById("newShopCode").focus();
    return;
  }
  let id = slugify(name);
  let ownerUserId = null;
  if (!isLocalDemo) {
    const button = document.getElementById("createShopBtn");
    button.disabled = true;
    note.textContent = "Creating secure shop and owner account…";
    try {
      const result = await window.SalonBackend.provision({
        action: "create_shop", shopCode, shopName: name, location, country,
        username: ownerUsername, password: ownerPassword, ownerName: owner,
        openingCash: opening, language, vatEnabled: vat
      });
      id = result.shop.id;
      ownerUserId = result.userId;
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : "Shop could not be created.";
      button.disabled = false;
      return;
    }
    button.disabled = false;
  }
  shops.push({ id, shopCode, name, location, country, owner, ownerUsername, currency: profile.currency, enabled: true, status: "active" });
  shopStates[id] = createShopState({
    openingCash: opening,
    vatEnabled: vat,
    receiptEnabled: false,
    complianceDocuments: defaultComplianceDocuments(country),
    users: isLocalDemo
      ? defaultShopUsers(owner, ownerUsername, ownerPassword)
      : [{ id: ownerUserId, name: owner, username: ownerUsername, role: "Owner", active: true, createdAt: new Date().toISOString() }]
  });
  activeShopId = id;
  activeLanguage = language;
  hydrateActiveShop();
  migrateServices();
  note.textContent = `${name} created. Hand over the owner credentials below.`;
  document.getElementById("handoverCard").hidden = false;
  document.getElementById("handoverShop").textContent = `${name} · ${location}`;
  document.getElementById("handoverCredentials").textContent = `Shop ID: ${shopCode} · Username: ${ownerUsername} · Password: ${ownerPassword}`;
  document.getElementById("newShopCode").value = "";
  document.getElementById("newShopName").value = "";
  document.getElementById("newShopLocation").value = "";
  document.getElementById("newShopCountry").value = "AE";
  document.getElementById("newShopOwner").value = "";
  document.getElementById("newOwnerUsername").value = "";
  document.getElementById("newOwnerPassword").value = "";
  document.getElementById("closingOpeningCash").value = openingCash.toFixed(2);
  renderSaleServices();
  renderServiceTable();
  renderPurchaseTable();
  renderExpenseTable();
  renderCompliance();
  renderAuditLog();
  renderUserManagement();
  syncChecklist();
  syncSelectedServiceLabel();
  syncSummaryTotals();
  syncTaxSettings();
  updatePurchaseCalculation();
  saveState();
  showView(currentRole === "Platform Admin" ? "master-admin" : "dashboard");
}

function generatedPassword(prefix = "Temp") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return `${prefix.slice(0, 3)}!${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

async function resetOwnerPassword(shopId) {
  const shop = shops.find((candidate) => candidate.id === shopId);
  if (!shop) return;
  const shopState = shopStates[shopId] || createShopState();
  shopStates[shopId] = shopState;
  shopState.users = shopState.users?.length
    ? shopState.users
    : (isLocalDemo ? defaultShopUsers(shop.owner || "Owner", shop.ownerUsername || "owner") : []);
  const owner = shopState.users.find((user) => user.role === "Owner") || shopState.users[0];
  const password = generatedPassword("Owner");
  if (!isLocalDemo) {
    if (!owner?.id) {
      document.getElementById("masterNote").textContent = "Owner account could not be identified.";
      return;
    }
    try {
      await window.SalonBackend.provision({ action: "reset_password", shopId, userId: owner.id, password });
    } catch (error) {
      document.getElementById("masterNote").textContent = error instanceof Error ? error.message : "Password reset failed.";
      return;
    }
  }
  if (isLocalDemo) owner.password = password;
  owner.active = true;
  shop.ownerUsername = owner.username;
  document.getElementById("handoverCard").hidden = false;
  document.getElementById("handoverShop").textContent = `${shop.name} · owner password reset`;
  document.getElementById("handoverCredentials").textContent = `Shop ID: ${shop.shopCode} · Username: ${owner.username} · Password: ${password}`;
  document.getElementById("masterNote").textContent = "Owner password reset. Hand over the new credentials.";
  addAudit("Stock adjusted", `${currentRole} · reset owner password · ${shop.shopCode}`);
  saveState();
  renderMasterDashboard();
}

async function toggleShopStatus(shopId) {
  const shop = shops.find((candidate) => candidate.id === shopId);
  if (!shop) return;
  if (shop.id === activeShopId && shop.enabled !== false && shops.filter((candidate) => candidate.enabled !== false && candidate.id !== shopId).length === 0) {
    document.getElementById("masterNote").textContent = "At least one active shop is required.";
    return;
  }
  const nextEnabled = shop.enabled === false;
  if (!isLocalDemo) {
    try {
      await window.SalonBackend.provision({ action: "set_shop_status", shopId, status: nextEnabled ? "active" : "suspended" });
    } catch (error) {
      document.getElementById("masterNote").textContent = error instanceof Error ? error.message : "Shop status could not be changed.";
      return;
    }
  }
  shop.enabled = nextEnabled;
  shop.status = nextEnabled ? "active" : "suspended";
  if (shop.enabled === false && shop.id === activeShopId) {
    const next = shops.find((candidate) => candidate.enabled !== false && candidate.id !== shopId);
    if (next) switchShop(next.id);
  }
  document.getElementById("masterNote").textContent = `${shop.name} ${shop.enabled === false ? "suspended" : "restored"}.`;
  addAudit("Stock adjusted", `${currentRole} · ${shop.enabled === false ? "suspended" : "restored"} shop · ${shop.shopCode}`);
  saveState();
  renderMasterDashboard();
}

async function deleteShop(shopId) {
  const shop = shops.find((candidate) => candidate.id === shopId);
  if (!shop) return;
  if (shops.filter((candidate) => candidate.enabled !== false && candidate.id !== shopId && candidate.deleted !== true).length === 0) {
    document.getElementById("masterNote").textContent = "Cannot delete the last active shop.";
    return;
  }
  if (!window.confirm(`Archive ${shop.name}? Its records will be retained and access will be disabled.`)) return;
  if (!isLocalDemo) {
    try {
      await window.SalonBackend.provision({ action: "set_shop_status", shopId, status: "archived" });
    } catch (error) {
      document.getElementById("masterNote").textContent = error instanceof Error ? error.message : "Shop could not be archived.";
      return;
    }
  }
  shops = shops.filter((candidate) => candidate.id !== shopId);
  delete shopStates[shopId];
  if (activeShopId === shopId) {
    activeShopId = shops.find((candidate) => candidate.enabled !== false)?.id || shops[0]?.id;
    hydrateActiveShop();
  }
  document.getElementById("masterNote").textContent = `${shop.name} archived. Records were retained.`;
  addAudit("Stock adjusted", `${currentRole} · archived shop · ${shop.shopCode}`);
  saveState();
  syncSummaryTotals();
  renderMasterDashboard();
}

function renderUserManagement() {
  const table = document.getElementById("userTable");
  if (!table || !activeShopState) return;
  activeShopState.users = Array.isArray(activeShopState.users)
    ? activeShopState.users
    : (isLocalDemo ? defaultShopUsers(currentShop()?.owner || "Owner", currentShop()?.ownerUsername || "owner.albarsha") : []);
  table.innerHTML = "";
  activeShopState.users.forEach((user, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(user.name)}</strong></td>
      <td><code>${escapeHtml(user.username)}</code></td>
      <td>${escapeHtml(user.role)}</td>
      <td><span class="status-pill ${user.active === false ? "warning" : "ok"}">${user.active === false ? "Disabled" : "Active"}</span></td>
      <td>
        <div class="action-cluster">
          <button class="mini-action" data-reset-user="${index}" type="button">Reset</button>
          <button class="mini-action" data-toggle-user="${index}" type="button">${user.active === false ? "Enable" : "Disable"}</button>
          <button class="danger-button" data-delete-user="${index}" type="button">Archive</button>
        </div>
      </td>
    `;
    table.appendChild(row);
  });

  table.querySelectorAll("[data-reset-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!["Owner", "Shop Admin", "Platform Admin"].includes(currentRole)) return;
      const user = activeShopState.users[Number(button.dataset.resetUser)];
      if (!user) return;
      const password = generatedPassword(user.role === "Owner" ? "Owner" : "User");
      if (!isLocalDemo) {
        try {
          await window.SalonBackend.provision({ action: "reset_password", shopId: cloudTargetShopId(), userId: user.id, password });
        } catch (error) {
          document.getElementById("userAccessNote").textContent = error instanceof Error ? error.message : "Password reset failed.";
          return;
        }
      }
      user.password = password;
      user.active = true;
      document.getElementById("userAccessNote").textContent = `${user.name} password reset. Shop ID ${currentShopCode()}, username ${user.username}, password ${password}.`;
      addAudit("Stock adjusted", `${currentRole} · reset ${user.role} password · ${user.username}`);
      saveState();
      renderUserManagement();
    });
  });

  table.querySelectorAll("[data-toggle-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!["Owner", "Shop Admin", "Platform Admin"].includes(currentRole)) return;
      const user = activeShopState.users[Number(button.dataset.toggleUser)];
      if (!user || user.role === "Owner") {
        document.getElementById("userAccessNote").textContent = "Owner login cannot be disabled from this screen.";
        return;
      }
      const nextActive = user.active === false;
      if (!isLocalDemo) {
        try {
          await window.SalonBackend.provision({ action: "set_user_status", shopId: cloudTargetShopId(), userId: user.id, active: nextActive });
        } catch (error) {
          document.getElementById("userAccessNote").textContent = error instanceof Error ? error.message : "Account status could not be changed.";
          return;
        }
      }
      user.active = nextActive;
      addAudit("Stock adjusted", `${currentRole} · ${user.active ? "enabled" : "disabled"} user · ${user.username}`);
      saveState();
      renderUserManagement();
    });
  });

  table.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!["Owner", "Shop Admin", "Platform Admin"].includes(currentRole)) return;
      const index = Number(button.dataset.deleteUser);
      const user = activeShopState.users[index];
      if (!user || user.role === "Owner") {
        document.getElementById("userAccessNote").textContent = "Owner login cannot be deleted from this screen.";
        return;
      }
      if (!window.confirm(`Archive login for ${user.name}? Access will be disabled and the audit history retained.`)) return;
      if (!isLocalDemo) {
        try {
          await window.SalonBackend.provision({ action: "set_user_status", shopId: cloudTargetShopId(), userId: user.id, active: false });
        } catch (error) {
          document.getElementById("userAccessNote").textContent = error instanceof Error ? error.message : "Account could not be archived.";
          return;
        }
      }
      user.active = false;
      document.getElementById("userAccessNote").textContent = `${user.name} archived.`;
      addAudit("Stock adjusted", `${currentRole} · archived ${user.role} login · ${user.username}`);
      saveState();
      renderUserManagement();
    });
  });
}

async function createUserFromForm() {
  if (!["Owner", "Shop Admin", "Platform Admin"].includes(currentRole)) return;
  const name = document.getElementById("newUserName").value.trim();
  const username = document.getElementById("newUserUsername").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const role = document.getElementById("newUserRole").value;
  const note = document.getElementById("userAccessNote");
  activeShopState.users = activeShopState.users || [];

  if (!name || !username || !password) {
    note.textContent = "Name, username and password are required.";
    return;
  }
  if (password.length < 10) {
    note.textContent = "Password must be at least 10 characters.";
    return;
  }
  if (activeShopState.users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    note.textContent = "Username already exists in this shop.";
    return;
  }

  let userId = null;
  if (!isLocalDemo) {
    const button = document.getElementById("createUserBtn");
    button.disabled = true;
    note.textContent = "Creating secure account…";
    try {
      const result = await window.SalonBackend.provision({ action: "create_user", shopId: cloudTargetShopId(), name, username, password, role: backendRoleValues[role] });
      userId = result.userId;
    } catch (error) {
      note.textContent = error instanceof Error ? error.message : "User could not be created.";
      button.disabled = false;
      return;
    }
    button.disabled = false;
  }
  activeShopState.users.push({ id: userId, name, username, ...(isLocalDemo ? { password } : {}), role, active: true, createdAt: new Date().toISOString() });
  note.textContent = `${name} created. Login with Shop ID ${currentShopCode()}, username ${username} and the assigned password.`;
  document.getElementById("newUserName").value = "";
  document.getElementById("newUserUsername").value = "";
  document.getElementById("newUserPassword").value = "";
  addAudit("Stock adjusted", `${currentRole} · created ${role} login · ${username}`);
  saveState();
  renderUserManagement();
}

function updatePurchaseCalculation() {
  const qty = Number(document.getElementById("purchaseQty").value || 0);
  const unit = document.getElementById("purchaseUnit").value.trim() || "unit";
  const unitCost = Number(document.getElementById("purchaseUnitCost").value || 0);
  const discount = Number(document.getElementById("purchaseDiscount").value || 0);
  const subtotal = qty * unitCost;
  const total = Math.max(subtotal - discount, 0);

  document.getElementById("calcQty").textContent = `${qty.toLocaleString("en-AE")} ${translate(unit)}`;
  document.getElementById("calcUnitCost").textContent = moneyFixed(unitCost);
  document.getElementById("calcSubtotal").textContent = moneyFixed(subtotal);
  document.getElementById("calcPurchaseTotal").textContent = moneyFixed(total);
}

function renderSaleServices() {
  const container = document.getElementById("saleServices");
  container.innerHTML = "";
  const visibleServices = services
    .filter((service) => service.active)
    .filter((service) => activeSaleCategory === "All" || service.category === activeSaleCategory);

  if (!visibleServices.some((service) => service.name === selectedService.name)) {
    selectedService = visibleServices[0] || { name: "No service", price: 0, active: false };
  }
  selectedSaleServices = selectedSaleServices.filter((selected) => services.some((service) => service.name === selected.name && service.active !== false));
  if (!selectedSaleServices.length && selectedService.active !== false) selectedSaleServices = [selectedService];
  syncSelectedServiceLabel();

  visibleServices.forEach((service) => {
      const button = document.createElement("button");
      const selected = selectedSaleServices.some((candidate) => candidate.name === service.name);
      button.className = `service-tile ${selected ? "active" : ""}`;
      button.type = "button";
      button.innerHTML = `
        <strong class="${isRtlLanguage() ? "rtl-preview" : ""}">${escapeHtml(serviceName(service))}</strong>
        <small>${escapeHtml(translate(service.recipe))}</small>
        <span>${money(service.price)}</span>
      `;
      button.addEventListener("click", () => {
        selectedService = service;
        selectedSaleServices = selected
          ? selectedSaleServices.filter((candidate) => candidate.name !== service.name)
          : [...selectedSaleServices, service];
        if (!selectedSaleServices.length) selectedSaleServices = [service];
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
      <td><strong>${escapeHtml(serviceName(service))}</strong></td>
      <td class="${isRtlLanguage() ? "rtl-preview" : ""}">${escapeHtml(serviceName(service))}</td>
      <td>${escapeHtml(translate(service.category))}</td>
      <td>${money(service.price)}</td>
      <td>${escapeHtml(translate(service.recipe))}</td>
      <td>${translate(service.active ? "Active" : "Inactive")}</td>
      <td><button class="danger-button" data-delete-service="${index}" type="button">${translate("Delete")}</button></td>
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
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const index = Number(button.dataset.deleteService);
      if (!window.confirm("Delete this service? This action will be recorded in the audit trail.")) return;
      if (!await deleteCloudRecord(services[index], "service", index)) return;
      addAudit("Stock adjusted", `${currentRole} · service deleted · ${services[index]?.name || "service"}`);
      services.splice(index, 1);
      selectedService = services[0] || { name: "No service", price: 0, active: false };
      selectedSaleServices = selectedService.active === false ? [] : [selectedService];
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
      <td>${escapeHtml(purchase.supplier)}</td>
      <td>${escapeHtml(translate(purchase.item))}<br><small>${escapeHtml(purchase.qty)} ${escapeHtml(translate(purchase.unit))} × ${moneyFixed(purchase.unitCost)}</small></td>
      <td>${translate(purchase.payment || "Cash")}</td>
      <td>${moneyFixed(purchaseTotal(purchase))}</td>
      <td><button class="danger-button" data-delete-purchase="${index}" type="button">${translate("Delete")}</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-delete-purchase]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.deletePurchase);
      const purchase = purchases[index];
      if (!window.confirm("Delete this purchase? Expected cash will be recalculated.")) return;
      if (!await deleteCloudRecord(purchase, "purchase", index)) return;
      purchases.splice(index, 1);
      addAudit("Purchase entered", `${currentRole} · purchase deleted · ${purchase?.item || "purchase"} · ${moneyFixed(purchaseTotal(purchase || {}))}`);
      saveState();
      renderPurchaseTable();
      syncSummaryTotals();
      document.getElementById("purchaseNote").textContent = translate("Purchase deleted. Totals were recalculated.");
      applyTranslations();
    });
  });
}

function renderCustomerSelects() {
  const customerOptions = customers.map((customer) => `<option value="${escapeHtml(customer.id)}">${escapeHtml(customer.name)}${customer.phone ? ` · ${escapeHtml(customer.phone)}` : ""}</option>`).join("");
  ["saleCustomer", "bookingCustomer"].forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = customerOptions;
    if ([...select.options].some((option) => option.value === currentValue)) select.value = currentValue;
  });
  const serviceSelect = document.getElementById("bookingService");
  if (serviceSelect) {
    const currentValue = serviceSelect.value;
    serviceSelect.innerHTML = services
      .filter((service) => service.active)
      .map((service) => `<option>${escapeHtml(service.name)}</option>`)
      .join("");
    if ([...serviceSelect.options].some((option) => option.value === currentValue)) serviceSelect.value = currentValue;
  }
  const dateInput = document.getElementById("bookingDate");
  if (dateInput && !dateInput.value) dateInput.value = todayIso();
}

function renderClientMetrics() {
  const today = todayIso();
  const waiting = queueTickets.filter((ticket) => ["Waiting", "Booked", "In chair"].includes(ticket.status)).length;
  const todaysAppointments = queueTickets.filter((ticket) => ticket.type === "Appointment" && ticket.date === today).length;
  const deposits = queueTickets.reduce((sum, ticket) => sum + (Number(ticket.deposit) || 0), 0);
  document.getElementById("queueWaitingCount").textContent = String(waiting);
  document.getElementById("appointmentTodayCount").textContent = String(todaysAppointments);
  document.getElementById("customerProfileCount").textContent = String(customers.length);
  document.getElementById("appointmentDepositTotal").textContent = moneyFixed(deposits);
}

function renderCustomerTable() {
  const body = document.getElementById("customerTable");
  if (!body) return;
  body.innerHTML = "";
  customers.forEach((customer) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(customer.name)}</strong><br><small>${escapeHtml(customer.lastVisit ? `Last ${dateLabel(customer.lastVisit)}` : "No visit yet")}</small></td>
      <td>${escapeHtml(customer.phone || "-")}</td>
      <td>${escapeHtml(customer.visits || 0)}${customer.noShows ? `<br><small>${escapeHtml(customer.noShows)} no-show</small>` : ""}</td>
      <td>${escapeHtml(customer.preference || "-")}</td>
      <td>${escapeHtml(customer.riskNote || "-")}</td>
      <td><button class="mini-action" data-select-customer="${escapeHtml(customer.id)}" type="button">Use</button></td>
    `;
    body.appendChild(row);
  });
  body.querySelectorAll("[data-select-customer]").forEach((button) => {
    button.addEventListener("click", async () => {
      document.getElementById("saleCustomer").value = button.dataset.selectCustomer;
      showView("quick-sale");
    });
  });
}

function queueStatusAction(status) {
  if (status === "Booked") return "Check in";
  if (status === "Waiting") return "Start";
  if (status === "In chair") return "Complete";
  return "Archive";
}

function nextQueueStatus(status) {
  if (status === "Booked") return "Waiting";
  if (status === "Waiting") return "In chair";
  if (status === "In chair") return "Completed";
  return "Archived";
}

function renderQueueTable() {
  const body = document.getElementById("queueTable");
  if (!body) return;
  body.innerHTML = "";
  queueTickets
    .filter((ticket) => ticket.status !== "Archived")
    .forEach((ticket) => {
      const customer = customerById(ticket.customerId);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${escapeHtml(customer.name)}</strong><br><small>${escapeHtml(ticket.type)}${ticket.deposit ? ` · ${moneyFixed(ticket.deposit)} deposit` : ""}</small></td>
        <td>${escapeHtml(ticket.service)}</td>
        <td>${escapeHtml(ticket.date)} · ${escapeHtml(ticket.time || "Now")}</td>
        <td>${escapeHtml(ticket.staff || "-")}</td>
        <td><span class="status-pill ${ticket.status === "Completed" ? "ok" : ticket.status === "No-show" ? "danger" : "warning"}">${escapeHtml(ticket.status)}</span></td>
        <td>
          <div class="action-cluster">
            <button class="mini-action" data-queue-next="${escapeHtml(ticket.id)}" type="button">${queueStatusAction(ticket.status)}</button>
            <button class="danger-button" data-queue-noshow="${escapeHtml(ticket.id)}" type="button">No-show</button>
          </div>
        </td>
      `;
      body.appendChild(row);
  });
  body.querySelectorAll("[data-queue-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const ticket = queueTickets.find((item) => item.id === button.dataset.queueNext);
      updateQueueStatus(button.dataset.queueNext, nextQueueStatus(ticket?.status));
    });
  });
  body.querySelectorAll("[data-queue-noshow]").forEach((button) => {
    button.addEventListener("click", () => updateQueueStatus(button.dataset.queueNoshow, "No-show"));
  });
}

function renderClientsQueue() {
  renderCustomerSelects();
  renderClientMetrics();
  renderQueueTable();
  renderCustomerTable();
  applyTranslations();
}

function saveCustomerFromForm() {
  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const preference = document.getElementById("customerPreference").value.trim();
  const riskNote = document.getElementById("customerRiskNote").value.trim();
  const note = document.getElementById("customerNote");
  if (!name) {
    note.textContent = "Customer name is required.";
    document.getElementById("customerName").focus();
    return;
  }
  const existing = customers.find((customer) => customer.phone && phone && customer.phone === phone);
  if (existing) {
    Object.assign(existing, { name, phone, preference, riskNote });
    note.textContent = `${name} profile updated.`;
  } else {
    customers.push({ id: uniqueCustomerId(name), name, phone, preference, riskNote, visits: 0, noShows: 0, lastVisit: "" });
    note.textContent = `${name} saved and available in Quick Sale.`;
  }
  document.getElementById("customerName").value = "Walk-in Guest";
  document.getElementById("customerPhone").value = "";
  document.getElementById("customerPreference").value = "";
  document.getElementById("customerRiskNote").value = "";
  addAudit("Stock adjusted", `${currentRole} · customer saved · ${name}`);
  saveState();
  renderClientsQueue();
}

function saveBookingFromForm() {
  const customerId = document.getElementById("bookingCustomer").value;
  const type = document.getElementById("bookingType").value;
  const service = document.getElementById("bookingService").value;
  const staff = document.getElementById("bookingStaff").value.trim() || "Any staff";
  const date = document.getElementById("bookingDate").value || todayIso();
  const time = document.getElementById("bookingTime").value || new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const deposit = numberValue("bookingDeposit");
  const customer = customerById(customerId);
  queueTickets.push({
    id: `q-${Date.now()}`,
    customerId,
    service,
    staff,
    type,
    date,
    time,
    deposit,
    status: type === "Appointment" ? "Booked" : "Waiting",
    createdAt: new Date().toISOString()
  });
  if (type === "Appointment") appointments.push({ customerId, service, staff, date, time, deposit, status: "Booked" });
  document.getElementById("bookingNote").textContent = `${customer.name} added as ${type.toLowerCase()} for ${service}.`;
  addAudit("Stock adjusted", `${currentRole} · ${type.toLowerCase()} added · ${customer.name} · ${service}`);
  saveState();
  renderClientsQueue();
  renderLaunchAudit();
}

function updateQueueStatus(ticketId, status) {
  const ticket = queueTickets.find((item) => item.id === ticketId);
  if (!ticket) return;
  ticket.status = status;
  const customer = customerById(ticket.customerId);
  if (status === "Completed") {
    customer.visits = Number(customer.visits || 0) + 1;
    customer.lastVisit = todayIso();
  }
  if (status === "No-show") {
    customer.noShows = Number(customer.noShows || 0) + 1;
  }
  addAudit("Stock adjusted", `${currentRole} · queue ${status.toLowerCase()} · ${customer.name}`);
  saveState();
  renderClientsQueue();
}

function renderExpenseTable() {
  const body = document.getElementById("expenseTable");
  body.innerHTML = "";
  expenses.forEach((expense, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${translate(expense.category)}</td>
      <td>${escapeHtml(translate(expense.note || "-"))}</td>
      <td>${translate(expense.payment)}</td>
      <td>${moneyFixed(Number(expense.amount) || 0)}</td>
      <td><button class="danger-button" data-delete-expense="${index}" type="button">${translate("Delete")}</button></td>
    `;
    body.appendChild(row);
  });

  body.querySelectorAll("[data-delete-expense]").forEach((button) => {
    button.addEventListener("click", async () => {
      const index = Number(button.dataset.deleteExpense);
      const expense = expenses[index];
      if (!window.confirm("Delete this expense? Expected cash will be recalculated.")) return;
      if (!await deleteCloudRecord(expense, "expense", index)) return;
      expenses.splice(index, 1);
      addAudit("Expense entered", `${currentRole} · expense deleted · ${expense?.category || "expense"} · ${moneyFixed(Number(expense?.amount) || 0)}`);
      saveState();
      renderExpenseTable();
      syncSummaryTotals();
      document.getElementById("expenseNote").textContent = translate("Expense deleted. Totals were recalculated.");
      applyTranslations();
    });
  });
}

document.getElementById("saveSale").addEventListener("click", () => {
  const selected = selectedSaleServices.filter((service) => service && service.active !== false);
  if (!selected.length) {
    document.getElementById("saleNote").textContent = "Select at least one service before saving.";
    return;
  }
  const amount = selected.reduce((sum, service) => sum + Math.max(Number(service.price) || 0, 0), 0);
  const payment = document.getElementById("paymentMethod").value;
  const staff = document.getElementById("saleStaff").value;
  const customer = selectedCustomer();
  const serviceList = selected.map((service) => service.name);
  const sale = {
    service: serviceList.join(" + "),
    services: serviceList,
    customerId: customer.id,
    customerName: customer.name,
    staff,
    payment,
    amount,
    discountReason: document.getElementById("discountReason").value.trim(),
    createdAt: new Date().toISOString()
  };
  sales.push(sale);
  if (customer?.id && customer.id !== "walk-in-guest") {
    customer.visits = Number(customer.visits || 0) + 1;
    customer.lastVisit = todayIso();
  }
  addAudit("Sale created", `${customer.name} · ${staff} · ${serviceList.join(" + ")} · ${payment} · ${moneyFixed(amount)}`);
  saveState();
  syncSummaryTotals();
  const taxText = vatEnabled ? "VAT invoice fields are active." : "No VAT was added.";
  document.getElementById("saleNote").textContent = activeLanguage === "en"
    ? `${serviceList.join(" + ")} saved. Cash, staff performance and stock recipe were updated. ${taxText}`
    : `${selected.map((service) => serviceName(service)).join(" + ")} ${activeLanguage === "ar" ? "تم حفظها" : activeLanguage === "hi" ? "सेव हुई" : "محفوظ ہو گئی"}.`;
  applyTranslations();
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
  if (!name || price < 0) {
    document.getElementById("serviceFormTitle").textContent = translate("Add / Edit Service");
    return;
  }
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
  addAudit("Stock adjusted", `${currentRole} · service saved · ${name} · ${moneyFixed(price)}`);
  renderServiceTable();
  renderSaleServices();
  saveState();
  syncSelectedServiceLabel();
  applyTranslations();
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
  applyTranslations();
});

document.querySelectorAll(".language-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    activeLanguage = button.dataset.lang || button.textContent.trim().toLowerCase();
    renderSaleServices();
    renderServiceTable();
    renderPurchaseTable();
    renderExpenseTable();
    renderCompliance();
    renderAuditLog();
    syncSelectedServiceLabel();
    syncSummaryTotals();
    syncTaxSettings();
    updatePurchaseCalculation();
    syncLanguageButtons();
    saveState();
  });
});

document.querySelectorAll("[data-category]").forEach((button) => {
  button.addEventListener("click", () => {
    activeSaleCategory = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((categoryButton) => {
      categoryButton.classList.toggle("active", categoryButton === button);
    });
    renderSaleServices();
  });
});

document.querySelectorAll("[data-checklist]").forEach((input) => {
  input.addEventListener("change", () => {
    checklist[input.dataset.checklist] = input.checked;
    addAudit("Stock adjusted", `${currentRole} · checklist updated · ${input.dataset.checklist}`);
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

document.getElementById("countrySelect").addEventListener("change", (event) => {
  applySelectedCountryProfile();
  syncTaxSettings();
});

document.getElementById("receiptModeSelect").addEventListener("change", (event) => {
  receiptEnabled = event.target.value !== "off";
  syncTaxSettings();
});

document.getElementById("saveSettings").addEventListener("click", () => {
  applySelectedCountryProfile();
  document.getElementById("settingsTaxPill").textContent = vatEnabled
    ? "VAT on"
    : "VAT optional";
  saveState();
});

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const shopCode = document.getElementById("loginShopId").value;
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPin").value;
  const loginError = document.getElementById("loginError");
  const submit = event.submitter || document.querySelector(".login-submit");
  submit.disabled = true;
  loginError.hidden = true;
  let login;
  try {
    login = isLocalDemo
      ? authenticateLogin({ shopCode, username, password })
      : await authenticateCloudLogin({ shopCode, username, password });
  } catch (error) {
    loginError.textContent = error instanceof Error ? error.message : "Unable to sign in.";
    login = { ok: false };
  } finally {
    submit.disabled = false;
  }
  if (!login.ok) {
    loginError.hidden = false;
    return;
  }
  loginError.hidden = true;
  enterAuthenticatedApp(login);
});

document.getElementById("logoutBtn").addEventListener("click", () => {
  if (!isLocalDemo) void window.SalonBackend.signOut();
  cloudIdentity = null;
  setSyncStatus("");
  window.scrollTo({ top: 0, left: 0 });
  document.body.classList.remove("is-authenticated");
  document.body.classList.remove("is-platform-admin");
  const frontpage = document.getElementById("frontpage");
  const appShell = document.getElementById("appShell");
  appShell.hidden = true;
  frontpage.hidden = false;
  appShell.classList.add("app-hidden");
  frontpage.classList.remove("front-hidden");
  document.getElementById("loginCurrencySignal").textContent = "GCC";
});

document.getElementById("printReport").addEventListener("click", () => {
  showView("reports");
  window.print();
});

document.getElementById("savePurchase").addEventListener("click", () => {
  const purchase = {
    supplier: document.getElementById("purchaseSupplier").value.trim(),
    type: document.getElementById("purchaseType").value,
    item: document.getElementById("purchaseItem").value.trim(),
    qty: Number(document.getElementById("purchaseQty").value || 0),
    unit: document.getElementById("purchaseUnit").value.trim() || "unit",
    unitCost: Number(document.getElementById("purchaseUnitCost").value || 0),
    discount: Number(document.getElementById("purchaseDiscount").value || 0),
    payment: document.getElementById("purchasePayment").value,
    createdAt: new Date().toISOString()
  };
  if (!purchase.supplier || !purchase.item || ![purchase.qty, purchase.unitCost, purchase.discount].every(Number.isFinite) || purchase.qty <= 0 || purchase.unitCost < 0 || purchase.discount < 0 || purchase.discount > purchase.qty * purchase.unitCost) {
    document.getElementById("purchaseNote").textContent = "Enter a valid item, quantity, unit cost and discount.";
    return;
  }

  purchases.push(purchase);
  saveState();
  addAudit("Purchase entered", `${currentRole} · ${purchase.item} · ${purchase.qty} ${purchase.unit} · ${moneyFixed(purchaseTotal(purchase))}`);
  renderPurchaseTable();
  syncSummaryTotals();
  document.getElementById("purchaseNote").textContent = activeLanguage === "en"
    ? `${purchase.item} saved. ${purchase.qty} ${purchase.unit} × ${moneyFixed(purchase.unitCost)} = ${moneyFixed(purchaseTotal(purchase))}.`
    : `${purchase.item} ${activeLanguage === "ar" ? "تم حفظها" : activeLanguage === "hi" ? "सेव हुआ" : "محفوظ ہو گیا"}: ${purchase.qty} ${purchase.unit} × ${moneyFixed(purchase.unitCost)} = ${moneyFixed(purchaseTotal(purchase))}.`;
  applyTranslations();
});

document.getElementById("saveExpense").addEventListener("click", () => {
  const expense = {
    category: document.getElementById("expenseCategory").value,
    amount: Number(document.getElementById("expenseAmount").value || 0),
    payment: document.getElementById("expensePayment").value,
    note: document.getElementById("expenseNoteInput").value.trim(),
    createdAt: new Date().toISOString()
  };
  if (expense.amount < 0) {
    document.getElementById("expenseNote").textContent = "Enter a valid expense amount.";
    return;
  }

  expenses.push(expense);
  saveState();
  addAudit("Expense entered", `${currentRole} · ${expense.category} · ${expense.payment} · ${moneyFixed(expense.amount)}`);
  renderExpenseTable();
  syncSummaryTotals();
  document.getElementById("expenseNote").textContent = activeLanguage === "en"
    ? `${expense.category} expense saved for ${moneyFixed(expense.amount)}.`
    : `${translate(expense.category)} ${activeLanguage === "ar" ? "تم حفظ المصروف" : activeLanguage === "hi" ? "खर्च सेव हुआ" : "خرچ محفوظ ہو گیا"} ${moneyFixed(expense.amount)}.`;
  applyTranslations();
});

["purchaseQty", "purchaseUnit", "purchaseUnitCost", "purchaseDiscount"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updatePurchaseCalculation);
});

["closingOpeningCash", "closingCashSales", "closingCashExpenses", "closingCashPurchases", "closingActualCash"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateClosingCalculation);
});

document.getElementById("approveClosing").addEventListener("click", () => {
  updateClosingCalculation();
  const expected = expectedCashTotal();
  const actual = numberValue("closingActualCash");
  const difference = actual - expected;
  const reason = document.getElementById("closingReason").value.trim();
  if (difference !== 0 && !reason) {
    document.getElementById("closingReason").focus();
    document.getElementById("closingDifference").textContent = translate("Shortage reason required.");
    return;
  }
  cashClosings.unshift({
    openingCash,
    cashSales: cashSalesTotal(),
    cashExpenses: cashOutTotal(expenses),
    cashPurchases: cashOutTotal(purchases),
    expected,
    actual,
    difference,
    reason,
    approvedBy: currentRole,
    createdAt: new Date().toISOString()
  });
  cashClosings = cashClosings.slice(0, 30);
  addAudit("Stock adjusted", `${currentRole} · day closed · ${moneyFixed(difference)}`);
  saveState();
  syncSummaryTotals();
  document.getElementById("closingReason").placeholder = translate("Cash closing approved.");
});

document.getElementById("saveExpiryDocument").addEventListener("click", async () => {
  const type = document.getElementById("expiryType").value;
  const holder = document.getElementById("expiryHolder").value.trim() || "Shop";
  const number = document.getElementById("expiryNumber").value.trim();
  const issueDate = document.getElementById("expiryIssueDate").value;
  const expiryDate = document.getElementById("expiryDate").value;
  const renewalCost = numberValue("expiryRenewalCost");
  const reminderDays = Math.max(Number(document.getElementById("expiryReminderDays").value || 30), 1);
  const evidence = document.getElementById("expiryEvidence").value.trim();
  const note = document.getElementById("expiryNote");
  let evidenceFile = null;
  if (!type || !expiryDate) {
    note.textContent = "Document type and expiry date are required.";
    return;
  }
  try {
    evidenceFile = await readEvidenceFile("expiryEvidenceFile");
    if (evidenceFile?.storagePath) {
      await window.SalonBackend.saveDocumentMetadata({
        shop_id: cloudTargetShopId(), title: `${type} · ${holder}`, category: type,
        issue_date: issueDate || null, expiry_date: expiryDate, reminder_days: reminderDays,
        object_path: evidenceFile.storagePath
      });
    }
  } catch (error) {
    note.textContent = error.message;
    return;
  }
  const existing = complianceDocuments.find((document) => document.type === type && document.holder.toLowerCase() === holder.toLowerCase());
  const nextRecord = { type, holder, number, issueDate, expiryDate, renewalCost, reminderDays, evidence: evidence || evidenceFile?.name || existing?.evidence || "" };
  if (evidenceFile) nextRecord.evidenceFile = evidenceFile;
  if (existing) {
    Object.assign(existing, nextRecord);
  } else {
    complianceDocuments.unshift(nextRecord);
  }
  addAudit("Stock adjusted", `${currentRole} · expiry saved · ${type} · ${holder} · ${dateLabel(expiryDate)}`);
  saveState();
  renderCompliance();
  note.textContent = `${type} saved for ${holder}. Reminder starts ${reminderDays} days before expiry.`;
  document.getElementById("expiryNumber").value = "";
  document.getElementById("expiryIssueDate").value = "";
  document.getElementById("expiryDate").value = "";
  document.getElementById("expiryRenewalCost").value = "0";
  document.getElementById("expiryReminderDays").value = "30";
  document.getElementById("expiryEvidence").value = "";
  document.getElementById("expiryEvidenceFile").value = "";
});

document.getElementById("addHygieneLog").addEventListener("click", async () => {
  const time = new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  const device = document.getElementById("hygieneDevice").value.trim();
  const operator = document.getElementById("hygieneOperator").value.trim() || currentRole;
  const cycle = document.getElementById("hygieneCycle").value.trim();
  const solution = document.getElementById("hygieneSolution").value.trim();
  const singleUse = document.getElementById("hygieneSingleUse").value.trim();
  const evidence = document.getElementById("hygieneEvidence").value.trim();
  const selectedFile = document.getElementById("hygieneEvidenceFile")?.files?.[0];
  let evidenceFile = null;
  if (!device || !cycle || (!evidence && !selectedFile)) {
    document.getElementById("hygieneNote").textContent = translate("Enter device, cycle and evidence before saving.");
    return;
  }
  try {
    evidenceFile = await readEvidenceFile("hygieneEvidenceFile");
    if (evidenceFile?.storagePath) {
      await window.SalonBackend.saveDocumentMetadata({
        shop_id: cloudTargetShopId(), title: `Hygiene evidence · ${device || "record"}`,
        category: "Hygiene", issue_date: todayIso(), expiry_date: null,
        reminder_days: 0, object_path: evidenceFile.storagePath
      });
    }
  } catch (error) {
    document.getElementById("hygieneNote").textContent = error.message;
    return;
  }
  hygieneLogs.unshift({
    time,
    device,
    operator,
    cycle,
    solution,
    singleUse,
    evidence: evidence || evidenceFile?.name || "",
    evidenceFile,
    status: "Ready"
  });
  hygieneLogs = hygieneLogs.slice(0, 12);
  addAudit("Stock adjusted", `${currentRole} · hygiene log added · ${device} · ${time}`);
  saveState();
  renderCompliance();
  document.getElementById("hygieneNote").textContent = translate("Hygiene log saved with evidence.");
  document.getElementById("hygieneEvidenceFile").value = "";
});

document.querySelectorAll("[data-export]").forEach((button) => {
  button.addEventListener("click", () => {
    const message = downloadDataExport(button.dataset.export);
    addAudit("Stock adjusted", `${currentRole} · export downloaded · ${button.dataset.export}`);
    document.querySelector(".ai-summary span").textContent = translate(message);
    applyTranslations();
  });
});

function syncTaxSettings() {
  const profile = currentCountryProfile();
  const taxMode = vatEnabled ? "VAT On" : "VAT Off";
  const branchLabel = vatEnabled ? "VAT enabled · tax invoice mode" : "VAT optional · currently off";
  const checkoutNote = vatEnabled ? "VAT on: tax invoice mode" : "VAT off: internal sale record only";
  const receiptText = receiptEnabled ? "Receipt on" : "Receipt off";
  const headerLabel = currentRole === "Platform Admin" ? "Platform network · GCC currencies" : `${todayLabel()} · ${profile.currency} · ${taxMode}`;

  document.body.classList.toggle("vat-enabled", vatEnabled);
  document.getElementById("loginCurrencySignal").textContent = document.body.classList.contains("is-authenticated") ? profile.currency : "GCC";
  document.getElementById("taxModeLabel").textContent = translate(taxMode);
  document.getElementById("branchTaxLabel").textContent = translate(branchLabel);
  document.getElementById("topTaxLabel").textContent = headerLabel;
  document.getElementById("toggleVat").textContent = translate(vatEnabled ? "Turn VAT off" : "Turn VAT on");
  document.getElementById("toggleReceipt").textContent = translate(receiptText);
  document.getElementById("checkoutTaxNote").textContent = translate(checkoutNote);
  document.getElementById("checkoutTaxMode").textContent = translate(taxMode);
  document.getElementById("checkoutReceiptMode").textContent = translate(receiptEnabled ? "Optional On" : "Optional Off");
  document.getElementById("salesCardLabel").textContent = translate(vatEnabled ? "Sales incl. VAT" : "Sales");
  document.getElementById("salesCardNote").textContent = activeLanguage === "en"
    ? `${totalServiceItemsSold()} services · ${purchases.length} purchase records · ${vatEnabled ? "VAT calculated separately" : "no VAT added"}`
    : `${totalServiceItemsSold()} · ${translate("Services")} · ${purchases.length} · ${translate("Purchases")}`;
  document.getElementById("vatModeSelect").value = vatEnabled ? "on" : "off";
  document.getElementById("countrySelect").value = currentShop()?.country || currencyToCountry[currentShop()?.currency] || "AE";
  document.getElementById("receiptModeSelect").value = receiptEnabled ? "simple" : "off";
  document.getElementById("settingsTaxPill").textContent = translate(vatEnabled ? "VAT On" : "VAT optional");
  syncShopIdentity();
  applyTranslations();
  saveState();
}

migrateServices();
removeLegacyDemoRows();
document.getElementById("closingOpeningCash").value = openingCash.toFixed(2);
saveState();
renderSaleServices();
renderClientsQueue();
renderServiceTable();
renderPurchaseTable();
renderExpenseTable();
renderCompliance();
renderAuditLog();
renderUserManagement();
renderAccounting();
renderLaunchAudit();
syncChecklist();
syncLanguageButtons();
syncSelectedServiceLabel();
syncTaxSettings();
syncReportTotals();
syncSummaryTotals();
updatePurchaseCalculation();
void restoreCloudLogin();
