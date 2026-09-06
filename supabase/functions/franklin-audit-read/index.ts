import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" }
});

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });
  const { token } = await request.json().catch(() => ({ token: "" }));
  if (typeof token !== "string" || token.length < 32 || token.length > 512) return json(400, { error: "INVALID_TOKEN" });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false }
  });
  const { data, error } = await admin.from("franklin_audit_sessions")
    .select("id,snapshot,created_at,expires_at,revoked_at,access_count")
    .eq("token_hash", tokenHash).maybeSingle();
  if (error) return json(500, { error: "AUDIT_LOOKUP_FAILED" });
  if (!data || data.revoked_at || Date.parse(data.expires_at) <= Date.now()) return json(404, { error: "AUDIT_SESSION_UNAVAILABLE" });
  await admin.from("franklin_audit_sessions").update({ access_count: data.access_count + 1 }).eq("id", data.id).is("revoked_at", null);
  return json(200, {
    snapshot: data.snapshot,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    readOnly: true
  });
});
