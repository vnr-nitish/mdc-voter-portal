import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type StartSessionRequest = {
  voterId?: string;
  electionId?: string;
};

const SESSION_DURATION_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as StartSessionRequest;
  const voterId = body.voterId?.trim();
  const electionId = body.electionId?.trim();

  if (!voterId || !electionId) {
    return NextResponse.json({ error: "Missing voterId or electionId." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: voter, error: voterError } = await supabase
    .from("voters")
    .select("id, auth_user_id")
    .eq("id", voterId)
    .maybeSingle();

  if (voterError || !voter) {
    return NextResponse.json({ error: "Voter not found." }, { status: 404 });
  }

  if (voter.auth_user_id && voter.auth_user_id !== user.id) {
    return NextResponse.json({ error: "Voter does not belong to this account." }, { status: 403 });
  }

  if (!voter.auth_user_id) {
    await supabase.from("voters").update({ auth_user_id: user.id }).eq("id", voterId);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("election_voters")
    .select("id")
    .eq("election_id", electionId)
    .eq("voter_id", voterId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Voter is not registered for this election." }, { status: 403 });
  }

  const { data: election, error: electionError } = await supabase
    .from("elections")
    .select("id, is_active")
    .eq("id", electionId)
    .maybeSingle();

  if (electionError || !election?.is_active) {
    return NextResponse.json({ error: "Election is inactive or missing." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const { data: activeSession } = await supabase
    .from("sessions")
    .select("id, election_id, expires_at, is_active, started_at")
    .eq("voter_id", voterId)
    .eq("is_active", true)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeSession) {
    if (activeSession.election_id !== electionId) {
      return NextResponse.json(
        { error: "Another election session is already active. End it first." },
        { status: 409 }
      );
    }
    return NextResponse.json({ session: activeSession });
  }

  const { data: latestSameElection } = await supabase
    .from("sessions")
    .select("id")
    .eq("voter_id", voterId)
    .eq("election_id", electionId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSameElection) {
    const { data: revivedSession, error: reviveError } = await supabase
      .from("sessions")
      .update({ expires_at: expiresAt, is_active: true })
      .eq("id", latestSameElection.id)
      .select("id, election_id, expires_at, is_active, started_at")
      .single();

    if (reviveError || !revivedSession) {
      return NextResponse.json({ error: reviveError?.message || "Unable to revive session." }, { status: 500 });
    }

    return NextResponse.json({ session: revivedSession });
  }

  const { data: newSession, error: createError } = await supabase
    .from("sessions")
    .insert({ voter_id: voterId, election_id: electionId, expires_at: expiresAt, is_active: true })
    .select("id, election_id, expires_at, is_active, started_at")
    .single();

  if (createError || !newSession) {
    return NextResponse.json({ error: createError?.message || "Unable to start session." }, { status: 500 });
  }

  return NextResponse.json({ session: newSession });
}
