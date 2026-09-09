import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://libertylightllc-ctrl.github.io",
  "http://127.0.0.1:5207",
  "http://localhost:5182",
  "http://localhost:5183"
]);

function response(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://libertylightllc-ctrl.github.io",
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
      const { data: shop, error: shopError } = await admin.from("salon_shops").insert({ code, name, country }).select().single();
      if (shopError) throw shopError;
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email: authEmail(code, username), password, email_confirm: true,
        user_metadata: { display_name: String(payload.ownerName || "Owner") }
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
      return response(origin, { shop, username });
    }

    const shopId = clean(payload.shopId, /^[0-9a-f-]{36}$/i, "shop");
    const role = await callerRole(shopId);
    if (!["platform_admin", "owner", "shop_admin"].includes(String(role))) return response(origin, { error: "Forbidden" }, 403);

    if (action === "create_user") {
      const targetRole = clean(payload.role, /^(owner|shop_admin|cashier|staff)$/, "role");
      if (role === "shop_admin" && ["owner", "shop_admin"].includes(targetRole)) return response(origin, { error: "Only an owner can grant management access" }, 403);
      const username = clean(payload.username, /^[a-zA-Z0-9._-]{3,64}$/, "username").toLowerCase();
      const password = clean(payload.password, /^.{10,128}$/, "password");
      const { data: shop } = await admin.from("salon_shops").select("code").eq("id", shopId).single();
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email: authEmail(shop.code, username), password, email_confirm: true,
        user_metadata: { display_name: String(payload.name || username) }
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
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return response(origin, { updated: true });
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
