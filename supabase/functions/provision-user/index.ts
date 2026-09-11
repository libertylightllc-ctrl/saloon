import { createClient } from "npm:@supabase/supabase-js@2";

function allowedOrigin(origin: string) {
  if (origin === "https://libertylightllc-ctrl.github.io") return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  return "https://libertylightllc-ctrl.github.io";
}

function response(origin: string, body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowedOrigin(origin),
      "Access-Control-Allow-Headers": "authorization, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin"
    }
  });
}

function clean(value: unknown, pattern: RegExp, name: string) {
  const result = String(value || "").trim();
  if (!pattern.test(result)) throw new Error(`Invalid ${name}`);
  return result;
}

function authEmail(shopCode: string, username: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return `${normalize(shopCode)}.${normalize(username)}@auth.saloncontrol.app`;
}

function starterCatalog(shopId: string, country: string, actor: string) {
  const services = [
    ["svc-haircut", "Haircut", "Hair", 25, [{ itemId: "inv-neck-strips", quantity: 1 }]],
    ["svc-shave", "Shave", "Beard", 15, [{ itemId: "inv-blades", quantity: 1 }, { itemId: "inv-foam", quantity: 8 }, { itemId: "inv-tissues", quantity: 2 }]],
    ["svc-beard-trim", "Beard Trim", "Beard", 10, [{ itemId: "inv-tissues", quantity: 1 }]],
    ["svc-beard-color", "Beard Color", "Color", 45, [{ itemId: "inv-beard-color", quantity: 20 }, { itemId: "inv-developer", quantity: 20 }, { itemId: "inv-gloves", quantity: 1 }]],
    ["svc-hair-color", "Hair Color", "Color", 80, [{ itemId: "inv-hair-color", quantity: 60 }, { itemId: "inv-developer", quantity: 60 }, { itemId: "inv-gloves", quantity: 1 }]],
    ["svc-facial", "Facial", "Face", 60, [{ itemId: "inv-facial-cream", quantity: 10 }]],
    ["svc-head-massage", "Head Massage", "Massage", 35, [{ itemId: "inv-oil", quantity: 15 }]]
  ];
  const inventory = [
    ["inv-blades", "Blades", "consumable", "pcs", 80, 1.2],
    ["inv-foam", "Shaving Foam", "consumable", "ml", 2500, 0.03],
    ["inv-oil", "Hair Oil", "consumable", "ml", 1000, 0.05],
    ["inv-developer", "Developer 20 Vol", "consumable", "ml", 1000, 0.04],
    ["inv-beard-color", "Beard Color", "consumable", "ml", 300, 0.18],
    ["inv-hair-color", "Hair Color", "consumable", "ml", 600, 0.2],
    ["inv-gloves", "Gloves", "consumable", "pairs", 30, 0.7],
    ["inv-tissues", "Tissues", "consumable", "pcs", 150, 0.05],
    ["inv-neck-strips", "Neck Strips", "consumable", "pcs", 80, 0.15],
    ["inv-facial-cream", "Facial Cream", "consumable", "ml", 200, 0.16],
    ["inv-machine", "Trimming Machine", "asset", "pcs", 1, 450],
    ["inv-scissors", "Scissors", "asset", "pcs", 2, 120]
  ];
  const tenancy = country === "AE" ? "Ejari / tenancy contract" : "Commercial lease / tenancy contract";
  const health = country === "AE" ? "Occupational health card" : "Municipal health certificate";
  const requirements = [tenancy, "Trade licence", "Pest control certificate", health, "Staff visa / residence permit", "Staff vaccination record"];
  return [
    ...services.map(([id, name, category, price, recipeItems]) => ({
      shop_id: shopId, record_type: "service", external_id: id, created_by: actor,
      data: { id, name, category, price, recipeItems, active: true }
    })),
    ...inventory.map(([id, name, type, unit, reorderLevel, unitCost]) => ({
      shop_id: shopId, record_type: "inventory_item", external_id: id, created_by: actor,
      data: { id, name, type, unit, quantity: 0, reorderLevel, unitCost, assignedTo: "Store room", condition: "Good", maintenanceDate: "", active: true }
    })),
    ...requirements.map((type, index) => ({
      shop_id: shopId, record_type: "compliance_document", external_id: `requirement-${index + 1}`, created_by: actor,
      data: { id: `requirement-${index + 1}`, type, holder: index === 0 || index === 2 ? "Shop premises" : index === 1 ? "Company" : "Staff file", number: "", issueDate: "", expiryDate: "", renewalCost: 0, evidence: "", reminderDays: 30, status: "Not set", active: true }
    }))
  ];
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  if (request.method === "OPTIONS") return response(origin, {}, 204);
  if (request.method !== "POST") return response(origin, { error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) return response(origin, { error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const token = authorization.slice(7);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return response(origin, { error: "Unauthorized" }, 401);
    const callerId = authData.user.id;
    const payload = await request.json();
    const action = String(payload.action || "");
    const { data: platformRow } = await admin.from("salon_platform_admins").select("user_id").eq("user_id", callerId).maybeSingle();
    const isPlatform = Boolean(platformRow);

    async function callerRole(shopId: string) {
      if (isPlatform) return "platform_admin";
      const { data } = await admin.from("salon_memberships").select("role,active").eq("shop_id", shopId).eq("user_id", callerId).maybeSingle();
      return data?.active ? data.role : null;
    }

    if (action === "create_shop") {
      if (!isPlatform) return response(origin, { error: "Forbidden" }, 403);
      const code = clean(payload.shopCode, /^[A-Z0-9_-]{3,32}$/, "shop code").toUpperCase();
      const name = clean(payload.shopName, /^.{1,160}$/, "shop name");
      const country = clean(payload.country, /^(AE|SA|QA|KW|BH|OM)$/, "country");
      const username = clean(payload.username, /^[a-zA-Z0-9._-]{3,64}$/, "username").toLowerCase();
      const password = clean(payload.password, /^.{10,128}$/, "password");
      const { data: shop, error: shopError } = await admin.from("salon_shops").insert({
        code, name, country, vat_enabled: Boolean(payload.vatEnabled)
      }).select().single();
      if (shopError) throw shopError;
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email: authEmail(code, username), password, email_confirm: true,
        user_metadata: { display_name: String(payload.ownerName || "Owner"), must_change_password: true }
      });
      if (userError || !created.user) {
        await admin.from("salon_shops").delete().eq("id", shop.id);
        throw userError || new Error("Owner account could not be created");
      }
      const { error: memberError } = await admin.from("salon_memberships").insert({ shop_id: shop.id, user_id: created.user.id, role: "owner" });
      if (memberError) {
        await admin.auth.admin.deleteUser(created.user.id);
        await admin.from("salon_shops").delete().eq("id", shop.id);
        throw memberError;
      }
      const initializedAt = new Date().toISOString();
      const { error: recordsError } = await admin.from("salon_records").insert([{
        shop_id: shop.id,
        record_type: "shop_setting",
        external_id: "operations",
        created_by: callerId,
        data: {
          location: String(payload.location || ""),
          openingCash: Number(payload.openingCash || 0),
          activeLanguage: String(payload.language || "en"),
          vatEnabled: Boolean(payload.vatEnabled),
          receiptEnabled: false,
          catalogInitializedAt: initializedAt
        }
      }, ...starterCatalog(shop.id, country, callerId)]);
      if (recordsError) {
        await admin.auth.admin.deleteUser(created.user.id);
        await admin.from("salon_shops").delete().eq("id", shop.id);
        throw recordsError;
      }
      return response(origin, { shop, username, userId: created.user.id, catalogInitializedAt: initializedAt });
    }

    const shopId = clean(payload.shopId, /^[0-9a-f-]{36}$/i, "shop");
    const role = await callerRole(shopId);
    if (!["platform_admin", "owner", "shop_admin"].includes(String(role))) return response(origin, { error: "Forbidden" }, 403);

    if (action === "initialize_shop") {
      const { data: shop, error: shopError } = await admin.from("salon_shops").select("country").eq("id", shopId).single();
      if (shopError) throw shopError;
      const { data: settings, error: settingsError } = await admin.from("salon_records")
        .select("id,data").eq("shop_id", shopId).eq("record_type", "shop_setting").eq("external_id", "operations").maybeSingle();
      if (settingsError) throw settingsError;
      if (settings?.data?.catalogInitializedAt) return response(origin, { initialized: true, idempotent: true });
      const { error: catalogError } = await admin.from("salon_records").upsert(starterCatalog(shopId, shop.country, callerId), {
        onConflict: "shop_id,record_type,external_id",
        ignoreDuplicates: true
      });
      if (catalogError) throw catalogError;
      const initializedAt = new Date().toISOString();
      const settingsData = { ...(settings?.data || {}), catalogInitializedAt: initializedAt };
      const settingsWrite = settings
        ? admin.from("salon_records").update({ data: settingsData }).eq("id", settings.id)
        : admin.from("salon_records").insert({ shop_id: shopId, record_type: "shop_setting", external_id: "operations", created_by: callerId, data: settingsData });
      const { error: settingsWriteError } = await settingsWrite;
      if (settingsWriteError) throw settingsWriteError;
      return response(origin, { initialized: true, initializedAt });
    }

    if (action === "list_users") {
      const { data: memberships, error } = await admin.from("salon_memberships").select("user_id,role,active,created_at").eq("shop_id", shopId);
      if (error) throw error;
      const users = await Promise.all((memberships || []).map(async (membership) => {
        const { data } = await admin.auth.admin.getUserById(membership.user_id);
        const email = data.user?.email || "";
        const username = email.split("@")[0].split(".").slice(1).join(".");
        return {
          id: membership.user_id,
          name: data.user?.user_metadata?.display_name || username,
          username,
          role: membership.role,
          active: membership.active,
          createdAt: membership.created_at
        };
      }));
      return response(origin, { users });
    }

    if (action === "create_user") {
      const targetRole = clean(payload.role, /^(owner|shop_admin|cashier|staff)$/, "role");
      if (role === "shop_admin" && ["owner", "shop_admin"].includes(targetRole)) return response(origin, { error: "Only an owner can grant management access" }, 403);
      const username = clean(payload.username, /^[a-zA-Z0-9._-]{3,64}$/, "username").toLowerCase();
      const password = clean(payload.password, /^.{10,128}$/, "password");
      const { data: shop } = await admin.from("salon_shops").select("code").eq("id", shopId).single();
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email: authEmail(shop.code, username), password, email_confirm: true,
        user_metadata: { display_name: String(payload.name || username), must_change_password: true }
      });
      if (userError || !created.user) throw userError || new Error("User could not be created");
      const { error: memberError } = await admin.from("salon_memberships").insert({ shop_id: shopId, user_id: created.user.id, role: targetRole });
      if (memberError) { await admin.auth.admin.deleteUser(created.user.id); throw memberError; }
      return response(origin, { userId: created.user.id, username, role: targetRole });
    }

    if (action === "reset_password") {
      const userId = clean(payload.userId, /^[0-9a-f-]{36}$/i, "user");
      const password = clean(payload.password, /^.{10,128}$/, "password");
      const { data: membership } = await admin.from("salon_memberships").select("role").eq("shop_id", shopId).eq("user_id", userId).single();
      if (role === "shop_admin" && ["owner", "shop_admin"].includes(membership.role)) return response(origin, { error: "Only an owner can reset management access" }, 403);
      const { data: targetUser } = await admin.auth.admin.getUserById(userId);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { ...(targetUser.user?.user_metadata || {}), must_change_password: true }
      });
      if (error) throw error;
      return response(origin, { updated: true });
    }

    if (action === "set_user_status") {
      const userId = clean(payload.userId, /^[0-9a-f-]{36}$/i, "user");
      const active = Boolean(payload.active);
      const { data: membership } = await admin.from("salon_memberships").select("role").eq("shop_id", shopId).eq("user_id", userId).single();
      if (membership.role === "owner") return response(origin, { error: "Owner access cannot be disabled here" }, 403);
      if (role === "shop_admin" && membership.role === "shop_admin") return response(origin, { error: "Only an owner can change management access" }, 403);
      const { error } = await admin.from("salon_memberships").update({ active }).eq("shop_id", shopId).eq("user_id", userId);
      if (error) throw error;
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
      if (authUpdateError) throw authUpdateError;
      return response(origin, { active });
    }

    if (action === "set_shop_status" && isPlatform) {
      const status = clean(payload.status, /^(active|suspended|archived)$/, "status");
      const { error } = await admin.from("salon_shops").update({ status }).eq("id", shopId);
      if (error) throw error;
      return response(origin, { status });
    }

    return response(origin, { error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("provision-user failed", error instanceof Error ? error.message : "unknown error");
    return response(origin, { error: error instanceof Error ? error.message : "Request failed" }, 400);
  }
});
