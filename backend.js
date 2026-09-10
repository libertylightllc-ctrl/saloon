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
      return { session, identity };
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
      return rows?.[0] ? { session, identity: rows[0] } : null;
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

  async function provision(payload) {
    return request("/functions/v1/provision-user", { method: "POST", body: JSON.stringify(payload) });
  }

  async function loadUsers(shopId) {
    return provision({ action: "list_users", shopId });
  }

  window.SalonBackend = { authEmail, signIn, signOut, restore, loadShops, loadRecords, upsertRecords, softDeleteRecord, uploadEvidence, saveDocumentMetadata, recordSale, refundSale, provision, loadUsers, isConfigured: true };
})();
