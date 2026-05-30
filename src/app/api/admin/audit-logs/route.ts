import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);
  if (!session) return null;
  return session;
};

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId");
  if (!electionId) {
    return NextResponse.json({ error: "Missing electionId" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const verificationFallback = async () => {
    const { data: requests, error: requestsError } = await supabase
      .from("verification_requests")
      .select("id, voter_id, photo_path, status, created_at, voter:voter_id (name, registration_number)")
      .eq("election_id", electionId)
      .in("status", ["approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (requestsError) {
      return [] as Array<Record<string, unknown>>;
    }

    return (requests ?? []).map((row: any) => ({
      id: row.id,
      action: row.status === "approved" ? "verification_approved" : "verification_rejected",
      entity: "verification_request",
      entity_id: row.id,
      election_id: electionId,
      actor: "system",
      metadata: {
        voter_id: row.voter_id,
        voter_name: row.voter?.name ?? null,
        registration_number: row.voter?.registration_number ?? null,
        source: "verification_requests",
      },
      photo_path: row.photo_path ?? null,
      created_at: row.created_at,
    }));
  };

  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, entity, entity_id, election_id, actor, metadata, created_at")
      .eq("election_id", electionId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("audit_logs") || message.includes("schema cache") || message.includes("does not exist")) {
        const fallback = await verificationFallback();
        return NextResponse.json({ auditLogs: fallback, unavailable: fallback.length === 0 });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!(data ?? []).length) {
      const fallback = await verificationFallback();
      if (fallback.length) {
        return NextResponse.json({ auditLogs: fallback });
      }
    }

    return NextResponse.json({ auditLogs: data ?? [] });
  } catch (err) {
    const fallback = await verificationFallback();
    return NextResponse.json({ auditLogs: fallback, unavailable: fallback.length === 0 });
  }
}
