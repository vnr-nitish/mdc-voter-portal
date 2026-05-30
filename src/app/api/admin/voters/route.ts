import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  return verifyAdminSession(token);
};

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const voter = body.voter;
  const electionId = body.electionId;
  if (!voter || !electionId) {
    return NextResponse.json({ error: "voter and electionId required" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const upsertVoter = await supabase
    .from("voters")
    .upsert(voter, { onConflict: "registration_number" })
    .select("id, registration_number, name, email, mobile_number")
    .limit(1)
    .maybeSingle();

  if (upsertVoter.error) {
    return NextResponse.json({ error: upsertVoter.error.message }, { status: 500 });
  }

  const voterId = (upsertVoter.data as any)?.id;
  if (!voterId) {
    return NextResponse.json({ error: "Unable to create voter" }, { status: 500 });
  }

  const { error: evError } = await supabase.from("election_voters").upsert({
    election_id: electionId,
    voter_id: voterId,
    is_verified: false,
    has_voted: false,
  }, { onConflict: "election_id,voter_id" });

  if (evError) {
    return NextResponse.json({ error: evError.message }, { status: 500 });
  }

  return NextResponse.json({ voter: upsertVoter.data });
}
