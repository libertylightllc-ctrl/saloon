(function () {
  const projectUrl = "https://vmoocchjtlpggnoadpio.supabase.co";
  const publishableKey = "sb_publishable_XBMSh3M1NhXyddawCvfDdw_B8vbSNha";
  const sessionKey = "salon-control-session";

  function authEmail(shopCode, username) {
    const clean = (value) => value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    return `${clean(shopCode)}.${clean(username)}@auth.saloncontrol.app`;
  }

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch { return null; }
  }

  function writeSession(session) {
    if (session) sessionStorage.setItem(sessionKey, JSON.stringify(session));
    else sessionStorage.removeItem(sessionKey);
  }

  async function refreshSession() {
    const current = readSession();
    if (!current?.refresh_token) throw new Error("Your session has expired. Please sign in again.");
    const response = await fetch(`${projectUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token })
    });
    if (!response.ok) {
      writeSession(null);
      throw new Error("Your session has expired. Please sign in again.");
    }
    const session = await response.json();
    writeSession(session);
    return session;
  }

  async function request(path, options = {}, retry = true) {
    let session = readSession();
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 30000 && session.refresh_token) {
      session = await refreshSession();
    }
    const response = await fetch(`${projectUrl}${path}`, {
      ...options,
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(options.headers || {})
      }
    });
    if (response.status === 401 && retry && session?.refresh_token && !path.startsWith("/auth/v1/token")) {
      await refreshSession();
      return request(path, options, false);
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.msg || body.message || body.error_description || "Cloud request failed");
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function signIn(shopCode, username, password) {
    const session = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: authEmail(shopCode, username), password })
    });
    writeSession(session);
    try {
      const rows = await request("/rest/v1/rpc/salon_session", { method: "POST", body: "{}" });
      const identity = rows?.find((row) => row.shop_code === shopCode.trim().toUpperCase()) || rows?.[0];
      if (!identity || (identity.shop_code !== "PLATFORM" && identity.shop_code !== shopCode.trim().toUpperCase())) {
        throw new Error("This account is not assigned to that shop");
      }
      return { session, identity, mustChangePassword: Boolean(session.user?.user_metadata?.must_change_password) };
    } catch (error) {
      writeSession(null);
      throw error;
    }
  }

  async function signOut() {
    try { await request("/auth/v1/logout", { method: "POST" }); } finally { writeSession(null); }
  }

  async function restore() {
    const session = readSession();
    if (!session?.access_token) return null;
    try {
      const rows = await request("/rest/v1/rpc/salon_session", { method: "POST", body: "{}" });
      return rows?.[0] ? { session, identity: rows[0], mustChangePassword: Boolean(session.user?.user_metadata?.must_change_password) } : null;
    } catch {
      writeSession(null);
      return null;
    }
  }

  async function loadRecords(shopId) {
    if (!shopId) return [];
    return request(`/rest/v1/salon_records?shop_id=eq.${encodeURIComponent(shopId)}&deleted_at=is.null&select=id,record_type,external_id,data,created_by,updated_at`);
  }

  async function loadShops() {
    return request("/rest/v1/salon_shops?select=id,code,name,country,status,vat_enabled,created_at&order=name");
  }

  async function upsertRecords(records) {
    if (!records.length) return [];
    return request("/rest/v1/salon_records?on_conflict=shop_id,record_type,external_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(records)
    });
  }

  async function softDeleteRecord(shopId, recordType, externalId) {
    return request(`/rest/v1/salon_records?shop_id=eq.${encodeURIComponent(shopId)}&record_type=eq.${encodeURIComponent(recordType)}&external_id=eq.${encodeURIComponent(externalId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ deleted_at: new Date().toISOString() })
    });
  }

  async function uploadEvidence(shopId, file) {
    let session = readSession();
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 30000) session = await refreshSession();
    if (!session?.access_token) throw new Error("Please sign in before uploading evidence.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "evidence";
    const objectPath = `${shopId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const routePath = objectPath.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${projectUrl}/storage/v1/object/salon-documents/${routePath}`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false"
      },
      body: file
    });
    if (!upload.ok) {
      const body = await upload.json().catch(() => ({}));
      throw new Error(body.message || body.error || "Evidence upload failed.");
    }
    const signed = await request(`/storage/v1/object/sign/salon-documents/${routePath}`, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 604800 })
    });
    const signedUrl = signed?.signedURL || signed?.signedUrl || "";
    return {
      name: file.name,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      storagePath: objectPath,
      dataUrl: signedUrl.startsWith("http") ? signedUrl : `${projectUrl}/storage/v1${signedUrl.startsWith("/") ? "" : "/"}${signedUrl}`
    };
  }

  async function signEvidence(objectPath) {
    const routePath = String(objectPath || "").split("/").map(encodeURIComponent).join("/");
    if (!routePath) throw new Error("Evidence file path is missing.");
    const signed = await request(`/storage/v1/object/sign/salon-documents/${routePath}`, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 604800 })
    });
    const signedUrl = signed?.signedURL || signed?.signedUrl || "";
    return signedUrl.startsWith("http") ? signedUrl : `${projectUrl}/storage/v1${signedUrl.startsWith("/") ? "" : "/"}${signedUrl}`;
  }

  async function saveDocumentMetadata(document) {
    return request("/rest/v1/salon_documents?on_conflict=object_path", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(document)
    });
  }

  async function recordSale(shopId, sale, stockUsage) {
    return request("/rest/v1/rpc/salon_record_sale", {
      method: "POST",
      body: JSON.stringify({
        target_shop: shopId,
        sale_external_id: sale.id,
        sale_data: sale,
        stock_usage: stockUsage
      })
    });
  }

  async function refundSale(shopId, refund) {
    return request("/rest/v1/rpc/salon_refund_sale", {
      method: "POST",
      body: JSON.stringify({
        target_shop: shopId,
        refund_external_id: refund.id,
        sale_external_id: refund.saleId,
        refund_data: refund
      })
    });
  }

  async function recordExpense(shopId, expense) {
    return request("/rest/v1/rpc/salon_record_expense", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, expense_external_id: expense.id, expense_data: expense })
    });
  }

  async function reverseExpense(shopId, expenseId, reason) {
    return request("/rest/v1/rpc/salon_reverse_expense", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, expense_external_id: expenseId, reversal_reason: reason })
    });
  }

  async function recordPurchase(shopId, purchase, inventoryItem) {
    return request("/rest/v1/rpc/salon_record_purchase", {
      method: "POST",
      body: JSON.stringify({
        target_shop: shopId,
        purchase_external_id: purchase.id,
        purchase_data: purchase,
        inventory_data: inventoryItem
      })
    });
  }

  async function reversePurchase(shopId, purchaseId, reason) {
    return request("/rest/v1/rpc/salon_reverse_purchase", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, purchase_external_id: purchaseId, reversal_reason: reason })
    });
  }

  async function recordSupplierPayment(shopId, payment) {
    return request("/rest/v1/rpc/salon_record_supplier_payment", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, payment_external_id: payment.id, payment_data: payment })
    });
  }

  async function reverseSupplierPayment(shopId, paymentId, reason) {
    return request("/rest/v1/rpc/salon_reverse_supplier_payment", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, payment_external_id: paymentId, reversal_reason: reason })
    });
  }

  async function saveInventoryItem(shopId, item, movementId, reason) {
    return request("/rest/v1/rpc/salon_save_inventory_item", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, item_external_id: item.id, change_external_id: movementId, item_data: item, change_reason: reason })
    });
  }

  async function recordStockMovement(shopId, movementId, itemId, type, quantity, reason) {
    return request("/rest/v1/rpc/salon_record_stock_movement", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, movement_external_id: movementId, item_external_id: itemId, movement_type: type, entered_quantity: quantity, movement_reason: reason })
    });
  }

  async function archiveInventoryItem(shopId, itemId, reason) {
    return request("/rest/v1/rpc/salon_archive_inventory_item", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, item_external_id: itemId, archive_reason: reason })
    });
  }

  async function saveService(shopId, service, reason) {
    return request("/rest/v1/rpc/salon_save_service", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, service_external_id: service.id, service_data: service, change_reason: reason })
    });
  }

  async function archiveService(shopId, serviceId, reason) {
    return request("/rest/v1/rpc/salon_archive_service", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, service_external_id: serviceId, archive_reason: reason })
    });
  }

  async function saveSupplier(shopId, supplier, reason) {
    return request("/rest/v1/rpc/salon_save_supplier", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, supplier_external_id: supplier.id, supplier_data: supplier, change_reason: reason })
    });
  }

  async function archiveSupplier(shopId, supplierId, reason) {
    return request("/rest/v1/rpc/salon_archive_supplier", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, supplier_external_id: supplierId, archive_reason: reason })
    });
  }

  async function saveCustomer(shopId, customer) {
    return request("/rest/v1/rpc/salon_save_customer", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, customer_external_id: customer.id, customer_data: customer })
    });
  }

  async function recordBooking(shopId, ticket) {
    return request("/rest/v1/rpc/salon_record_booking", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, ticket_external_id: ticket.id, ticket_data: ticket })
    });
  }

  async function updateBookingStatus(shopId, ticketId, status, reason = "") {
    return request("/rest/v1/rpc/salon_update_booking_status", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, ticket_external_id: ticketId, next_status: status, action_reason: reason })
    });
  }

  async function saveStaffProfile(shopId, profile, reason = "") {
    return request("/rest/v1/rpc/salon_save_staff_profile", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, profile_external_id: profile.id, profile_data: profile, change_reason: reason })
    });
  }

  async function archiveStaffProfile(shopId, profileId, reason) {
    return request("/rest/v1/rpc/salon_archive_staff_profile", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, profile_external_id: profileId, archive_reason: reason })
    });
  }

  async function saveAttendance(shopId, attendance, reason = "") {
    return request("/rest/v1/rpc/salon_save_attendance", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, attendance_external_id: attendance.id, attendance_data: attendance, change_reason: reason })
    });
  }

  async function recordStaffAdjustment(shopId, adjustment) {
    return request("/rest/v1/rpc/salon_record_staff_adjustment", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, adjustment_external_id: adjustment.id, adjustment_data: adjustment })
    });
  }

  async function generatePayroll(shopId, period) {
    return request("/rest/v1/rpc/salon_generate_payroll", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, target_period: period })
    });
  }

  async function payPayroll(shopId, payrollId, payment) {
    return request("/rest/v1/rpc/salon_pay_payroll", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, payroll_external_id: payrollId, payment_data: payment })
    });
  }

  async function saveComplianceDocument(shopId, document, reason = "") {
    return request("/rest/v1/rpc/salon_save_compliance_document", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, document_external_id: document.id, document_data: document, change_reason: reason })
    });
  }

  async function archiveComplianceDocument(shopId, documentId, reason) {
    return request("/rest/v1/rpc/salon_archive_compliance_document", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, document_external_id: documentId, archive_reason: reason })
    });
  }

  async function signInspection(shopId, inspection, reason = "") {
    return request("/rest/v1/rpc/salon_sign_inspection", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, inspection_external_id: inspection.id, inspection_data: inspection, change_reason: reason })
    });
  }

  async function recordHygieneLog(shopId, log) {
    return request("/rest/v1/rpc/salon_record_hygiene_log", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, log_external_id: log.id, log_data: log })
    });
  }

  async function saveProductRegistration(shopId, product, reason = "") {
    return request("/rest/v1/rpc/salon_save_product_registration", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, product_external_id: product.id, product_data: product, change_reason: reason })
    });
  }

  async function archiveProductRegistration(shopId, productId, reason) {
    return request("/rest/v1/rpc/salon_archive_product_registration", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, product_external_id: productId, archive_reason: reason })
    });
  }

  async function loadAccountingSnapshot(shopId) {
    return request("/rest/v1/rpc/salon_accounting_snapshot", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId })
    });
  }

  async function createBackup(shopId, label = "Manual snapshot") {
    return request("/rest/v1/rpc/salon_create_backup", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, backup_label: label })
    });
  }

  async function listBackups(shopId) {
    return request("/rest/v1/rpc/salon_list_backups", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId })
    });
  }

  async function getBackup(shopId, backupId) {
    return request("/rest/v1/rpc/salon_get_backup", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, backup_id: backupId })
    });
  }

  async function previewRestore(shopId, backupId) {
    return request("/rest/v1/rpc/salon_preview_restore", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, backup_id: backupId })
    });
  }

  async function restoreBackup(shopId, backupId, confirmationText) {
    return request("/rest/v1/rpc/salon_restore_backup", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, backup_id: backupId, confirmation_text: confirmationText })
    });
  }

  async function closeDay(shopId, closing) {
    return request("/rest/v1/rpc/salon_close_day", {
      method: "POST",
      body: JSON.stringify({
        target_shop: shopId,
        closing_external_id: closing.id,
        closing_data: closing
      })
    });
  }

  async function closeAccountingPeriod(shopId, period) {
    return request("/rest/v1/rpc/salon_close_accounting_period", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, target_period: period })
    });
  }

  async function reopenAccountingPeriod(shopId, period, reason) {
    return request("/rest/v1/rpc/salon_reopen_accounting_period", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId, target_period: period, reopen_reason: reason })
    });
  }

  async function recordLogin(shopId) {
    return request("/rest/v1/rpc/salon_record_login", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId || null })
    });
  }

  async function loadLoginHistory(shopId) {
    return request("/rest/v1/rpc/salon_login_history", {
      method: "POST",
      body: JSON.stringify({ target_shop: shopId || null })
    });
  }

  async function changePassword(password) {
    const result = await request("/auth/v1/user", {
      method: "PUT",
      body: JSON.stringify({ password, data: { must_change_password: false } })
    });
    const session = readSession();
    const updatedUser = result?.user || result;
    if (session?.user) writeSession({
      ...session,
      user: updatedUser?.id
        ? updatedUser
        : { ...session.user, user_metadata: { ...(session.user.user_metadata || {}), must_change_password: false } }
    });
    return result;
  }

  async function provision(payload) {
    return request("/functions/v1/provision-user", { method: "POST", body: JSON.stringify(payload) });
  }

  async function loadUsers(shopId) {
    return provision({ action: "list_users", shopId });
  }

  window.SalonBackend = { authEmail, signIn, signOut, restore, loadShops, loadRecords, upsertRecords, softDeleteRecord, uploadEvidence, signEvidence, saveDocumentMetadata, recordSale, refundSale, recordExpense, reverseExpense, recordPurchase, reversePurchase, recordSupplierPayment, reverseSupplierPayment, saveInventoryItem, recordStockMovement, archiveInventoryItem, saveService, archiveService, saveSupplier, archiveSupplier, saveCustomer, recordBooking, updateBookingStatus, saveStaffProfile, archiveStaffProfile, saveAttendance, recordStaffAdjustment, generatePayroll, payPayroll, saveComplianceDocument, archiveComplianceDocument, signInspection, recordHygieneLog, saveProductRegistration, archiveProductRegistration, loadAccountingSnapshot, createBackup, listBackups, getBackup, previewRestore, restoreBackup, closeDay, closeAccountingPeriod, reopenAccountingPeriod, recordLogin, loadLoginHistory, changePassword, provision, loadUsers, isConfigured: true };
})();
