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

  async function request(path, options = {}) {
    const session = readSession();
    const response = await fetch(`${projectUrl}${path}`, {
      ...options,
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(options.headers || {})
      }
    });
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

  async function provision(payload) {
    return request("/functions/v1/provision-user", { method: "POST", body: JSON.stringify(payload) });
  }

  window.SalonBackend = { authEmail, signIn, signOut, restore, loadShops, loadRecords, upsertRecords, provision, isConfigured: true };
})();
