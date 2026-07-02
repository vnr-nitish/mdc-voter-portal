import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);
  if (!session) {
    return null;
  }
  return session;
};

export async function GET(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminSupabaseClient();
    const { searchParams } = new URL(request.url);
    const requestedElectionId = searchParams.get("electionId");

    const { data: elections, error: electionsError } = await supabase
      .from("elections")
      .select("id, title, description, is_active, created_at")
      .order("created_at", { ascending: false });

    if (electionsError) {
      return NextResponse.json({ error: electionsError.message }, { status: 500 });
    }

    const allElections = elections ?? [];

    const selectedElectionId =
      requestedElectionId && allElections.some((item) => item.id === requestedElectionId)
        ? requestedElectionId
        : null;

    if (!selectedElectionId) {
      return NextResponse.json({
        elections: allElections,
        selectedElectionId: null,
        voters: [],
        pendingRequests: [],
        activeSessions: [],
        votes: [],
        candidates: [],
      });
    }

    const voterOptionalColumns = [
      "mobile_number",
      "school",
      "stream",
      "domain",
      "position",
      "stay",
      "branch",
      "year_of_study",
      "vote_points",
    ];
    const existingVoterOptional: string[] = [];

    for (const column of voterOptionalColumns) {
      try {
        const { error: checkError } = await supabase.from("voters").select(column).limit(1);
        if (!checkError) {
          existingVoterOptional.push(column);
        }
      } catch {
        // Ignore missing columns so the dashboard keeps working on older schemas.
      }
    }

    const voterSelect = [
      "id",
      "registration_number",
      "name",
      "email",
      "is_verified",
      "has_voted",
      "auth_user_id",
      ...existingVoterOptional,
    ].join(", ");

    const { data: electionVotersData } = await supabase
      .from("election_voters")
      .select(
        `id, voter_id, is_verified, has_voted, voter:voter_id (${voterSelect})`
      )
      .eq("election_id", selectedElectionId);

    const electionVoters = (electionVotersData ?? []) as unknown as Array<{
      voter?: Record<string, unknown>;
      is_verified: boolean;
      has_voted: boolean;
    }>;

    const voters =
      electionVoters?.map((item) => ({
        ...(item.voter ?? {}),
        is_verified: item.is_verified,
        has_voted: item.has_voted,
      })) ?? [];

    const { data: pendingRequests } = await supabase
      .from("verification_requests")
      .select("id, voter_id, photo_path, status, created_at, voter:voter_id (name, registration_number)")
      .eq("election_id", selectedElectionId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const { data: activeSessions } = await supabase
      .from("sessions")
      .select("id, voter_id, expires_at, is_active, voter:voter_id (name, registration_number)")
      .eq("election_id", selectedElectionId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true });
    const voteSelectAttempts = [
      "id, voter_id, reason, points, created_at, candidate_id, candidate:candidate_id (id, name), voter:voter_id (id, name, registration_number, email, school, stream, domain, position, stay, year_of_study, mobile_number, vote_points)",
      "id, voter_id, reason, created_at, candidate_id, candidate:candidate_id (id, name), voter:voter_id (id, name, registration_number, email, school, stream, domain, position, stay, year_of_study, mobile_number, vote_points)",
    ];

    let votes: unknown[] = [];
    for (const voteSelect of voteSelectAttempts) {
      const { data, error } = await supabase
        .from("votes")
        .select(voteSelect)
        .eq("election_id", selectedElectionId)
        .order("created_at", { ascending: false });

      if (!error) {
        votes = data ?? [];
        break;
      }

      const message = error.message.toLowerCase();
      const isSchemaCacheMismatch =
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the 'points' column");

      if (!isSchemaCacheMismatch) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    const candidateSelectAttempts = [
      "id, election_id, name, email, phone_number, manifesto, photo_url, created_at",
      "id, election_id, name, phone_number, manifesto, photo_url, created_at",
      "id, election_id, name, manifesto, photo_url, created_at",
      "id, election_id, name, created_at",
    ];

    let candidates: unknown[] = [];
    for (const candidateSelect of candidateSelectAttempts) {
      const { data, error } = await supabase
        .from("candidates")
        .select(candidateSelect)
        .eq("election_id", selectedElectionId)
        .order("created_at", { ascending: true });

      if (!error) {
        candidates = data ?? [];
        break;
      }

      const message = error.message.toLowerCase();
      const isSchemaCacheMismatch =
        message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("could not find the 'email' column") ||
        message.includes("could not find the 'phone_number' column") ||
        message.includes("could not find the 'manifesto' column") ||
        message.includes("could not find the 'photo_url' column");

      if (!isSchemaCacheMismatch) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      elections: allElections,
      selectedElectionId,
      voters: voters ?? [],
      pendingRequests: pendingRequests ?? [],
      activeSessions: activeSessions ?? [],
      votes: votes ?? [],
      candidates: candidates ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error:
          message.includes("Missing required environment variable") ||
          message.includes("fetch failed")
            ? "Admin dashboard is not configured correctly. Check Supabase and admin environment variables."
            : message,
      },
      { status: 500 }
    );
  }
}
