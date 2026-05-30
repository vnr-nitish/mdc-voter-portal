import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, phone, photo_url, manifesto, electionId } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!electionId) {
    return NextResponse.json({ error: "Missing electionId." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const insertPayload: Record<string, string | null> = {
    election_id: electionId,
    name,
    email: email ? String(email).trim().toLowerCase() : null,
    phone_number: phone ? String(phone).trim() : null,
    photo_url: photo_url || null,
    manifesto: manifesto || null,
  };

  let createdCandidate: Record<string, unknown> | null = null;
  let { data, error } = await supabase
    .from("candidates")
    .insert(insertPayload)
    .select("id, election_id, name, email, phone_number, manifesto, photo_url, created_at")
    .single();

  createdCandidate = data ?? null;

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const isMissingColumn = message.includes("does not exist") || message.includes("column") || message.includes("schema cache");
    if (isMissingColumn) {
      // Retry without optional fields that may be missing in older schemas.
      const reduced: Record<string, string | null> = {
        election_id: insertPayload.election_id,
        name: insertPayload.name,
        photo_url: insertPayload.photo_url || null,
        manifesto: insertPayload.manifesto || null,
      };
      const retry = await supabase
        .from("candidates")
        .insert(reduced)
        .select("id, election_id, name, manifesto, photo_url, created_at")
        .single();
      createdCandidate = retry.data ?? createdCandidate;
      error = retry.error;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await supabase.from("audit_logs").insert({
      action: "candidate_created",
      entity: "candidate",
      entity_id: (createdCandidate as { id?: string } | null)?.id ?? null,
      election_id: electionId,
      actor: session.sub,
      metadata: {
        admin_username: env.adminUsername ?? null,
        email: insertPayload.email,
        phone_number: insertPayload.phone_number,
        photo_url: insertPayload.photo_url,
        manifesto: insertPayload.manifesto,
      },
    });
  } catch {
    // best-effort audit trail
  }

  return NextResponse.json({ ok: true, candidate: createdCandidate });
}
