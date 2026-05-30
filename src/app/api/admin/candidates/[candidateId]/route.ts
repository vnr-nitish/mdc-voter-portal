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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateId } = await params;
  const { name, email, phone, photo_url, manifesto, electionId } = await request.json();

  if (!name || !String(name).trim()) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const updatePayload: Record<string, string | null> = {
    name: String(name).trim(),
    email: email ? String(email).trim().toLowerCase() : null,
    phone_number: phone ? String(phone).trim() : null,
    photo_url: photo_url ? String(photo_url).trim() : null,
    manifesto: manifesto ? String(manifesto).trim() : null,
  };

  let updatedCandidate: Record<string, unknown> | null = null;
  let query = supabase
    .from("candidates")
    .update(updatePayload)
    .eq("id", candidateId);

  if (electionId) {
    query = query.eq("election_id", electionId);
  }

  const typedQuery = query
    .select("id, election_id, name, email, phone_number, manifesto, photo_url, created_at")
    .single();

  let result = await typedQuery;
  let { error } = result;
  updatedCandidate = result.data ?? null;

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const isMissingColumn = message.includes("does not exist") || message.includes("column") || message.includes("schema cache");
    if (isMissingColumn) {
      // Retry update without optional fields that may be missing on older schemas.
      const reduced: Record<string, string | null> = {
        name: updatePayload.name,
        photo_url: updatePayload.photo_url || null,
        manifesto: updatePayload.manifesto || null,
      };
      let retryQuery = supabase.from("candidates").update(reduced).eq("id", candidateId);
      if (electionId) retryQuery = retryQuery.eq("election_id", electionId);
      const retryResult = await retryQuery;
      updatedCandidate = retryResult.data ?? updatedCandidate;
      error = retryResult.error;
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await supabase.from("audit_logs").insert({
      action: "candidate_updated",
      entity: "candidate",
      entity_id: candidateId,
      election_id: electionId ?? null,
      actor: (await requireAdmin())?.sub ?? null,
      metadata: {
        admin_username: env.adminUsername ?? null,
        email: updatePayload.email,
        phone_number: updatePayload.phone_number,
        photo_url: updatePayload.photo_url,
        manifesto: updatePayload.manifesto,
      },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true, candidate: updatedCandidate });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateId } = await params;
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("candidates").delete().eq("id", candidateId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await supabase.from("audit_logs").insert({
      action: "candidate_deleted",
      entity: "candidate",
      entity_id: candidateId,
      actor: (await requireAdmin())?.sub ?? null,
      metadata: { admin_username: env.adminUsername ?? null },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}
