import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  return verifyAdminSession(token);
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Missing overrides payload." }, { status: 400 });
  }

  const overrides = body.overrides as Record<string, { email?: string | null; phone_number?: string | null; manifesto?: string | null; photo_url?: string | null }>;
  if (!overrides || typeof overrides !== "object") {
    return NextResponse.json({ error: "Invalid overrides format." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const results: Record<string, { ok: boolean; error?: string }> = {};

  for (const id of Object.keys(overrides)) {
    const payload: Record<string, string | null> = {};
    const o = overrides[id] ?? {};
    if (o.email !== undefined) payload.email = o.email ?? null;
    if (o.phone_number !== undefined) payload.phone_number = o.phone_number ?? null;
    if (o.manifesto !== undefined) payload.manifesto = o.manifesto ?? null;
    if (o.photo_url !== undefined) payload.photo_url = o.photo_url ?? null;

    try {
      const { error } = await supabase.from("candidates").update(payload).eq("id", id);
      if (error) {
        results[id] = { ok: false, error: String(error.message || error) };
      } else {
        try {
          await supabase.from("audit_logs").insert({
            action: "candidate_overrides_applied",
            entity: "candidate",
            entity_id: id,
            election_id: null,
            actor: null,
            metadata: payload,
          });
        } catch {
          // best-effort
        }
        results[id] = { ok: true };
      }
    } catch (err) {
      results[id] = { ok: false, error: String(err) };
    }
  }

  return NextResponse.json({ ok: true, results });
}
