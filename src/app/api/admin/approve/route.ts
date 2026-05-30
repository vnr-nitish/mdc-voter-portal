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

  const { requestId, electionId, action, adminComment } = await request.json();
  if (!requestId || !electionId) {
    return NextResponse.json({ error: "Missing requestId or electionId." }, { status: 400 });
  }
  const status = action === "rejected" ? "rejected" : "approved";

  const supabase = createAdminSupabaseClient();
  const { data: requestRow } = await supabase
    .from("verification_requests")
    .select("voter_id, election_id")
    .eq("id", requestId)
    .eq("election_id", electionId)
    .single();

  if (!requestRow) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const { error: requestUpdateError } = await supabase
    .from("verification_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("election_id", electionId);
  if (requestUpdateError) {
    return NextResponse.json({ error: requestUpdateError.message }, { status: 500 });
  }

  if (status === "approved") {
    const { error: voterUpdateError } = await supabase
      .from("election_voters")
      .update({ is_verified: true })
      .eq("election_id", electionId)
      .eq("voter_id", requestRow.voter_id);
    if (voterUpdateError) {
      return NextResponse.json({ error: voterUpdateError.message }, { status: 500 });
    }
  }

  try {
    await supabase.from("audit_logs").insert({
      action: status === "approved" ? "verification_approved" : "verification_rejected",
      entity: "verification_request",
      entity_id: requestId,
      election_id: electionId,
      actor: session.sub,
      metadata: {
        voter_id: requestRow.voter_id,
        admin_comment: typeof adminComment === "string" ? adminComment.trim() : null,
        admin_username: env.adminUsername ?? null,
      },
    });
  } catch {
    // Audit logging is best-effort; approval/rejection should still succeed without the table.
  }

  return NextResponse.json({ ok: true });
}
