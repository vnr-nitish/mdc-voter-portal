import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SubmitVoteRequest = {
  voterId?: string;
  electionId?: string;
  candidateId?: string;
  reason?: string;
};

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as SubmitVoteRequest;
  const voterId = body.voterId?.trim();
  const electionId = body.electionId?.trim();
  const candidateId = body.candidateId?.trim();
  const reason = body.reason?.trim();

  if (!voterId || !electionId || !candidateId || !reason) {
    return NextResponse.json({ error: "Missing vote details." }, { status: 400 });
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
    .select("id, auth_user_id, vote_points")
    .eq("id", voterId)
    .maybeSingle();

  if (voterError || !voter || (voter.auth_user_id && voter.auth_user_id !== user.id)) {
    return NextResponse.json({ error: "Voter not found." }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("election_voters")
    .select("id, is_verified, has_voted")
    .eq("election_id", electionId)
    .eq("voter_id", voterId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "You are not registered for this election." }, { status: 403 });
  }

  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("id, election_id")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError || !candidate || candidate.election_id !== electionId) {
    return NextResponse.json({ error: "Selected candidate is not valid for this election." }, { status: 400 });
  }

  if (!membership.is_verified) {
    return NextResponse.json({ error: "Your verification is not approved yet." }, { status: 403 });
  }

  if (membership.has_voted) {
    return NextResponse.json({ error: "You have already voted in this election." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: sessionRow, error: sessionError } = await supabase
    .from("sessions")
    .select("id, election_id, expires_at, is_active")
    .eq("voter_id", voterId)
    .eq("election_id", electionId)
    .eq("is_active", true)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError || !sessionRow) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 403 });
  }

  const { data: insertedVote, error: voteError } = await supabase
    .from("votes")
    .insert({
      voter_id: voterId,
      election_id: electionId,
      candidate_id: candidateId,
      reason,
    })
    .select("id, voter_id, election_id, candidate_id, reason, created_at")
    .single();

  if (voteError || !insertedVote) {
    return NextResponse.json({ error: voteError?.message || "Unable to submit vote." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("election_voters")
    .update({ has_voted: true })
    .eq("voter_id", voterId)
    .eq("election_id", electionId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Vote saved, but status update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, vote: insertedVote });
}