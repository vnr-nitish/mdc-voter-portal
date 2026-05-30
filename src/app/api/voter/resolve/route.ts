import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ResolveRequest = {
  email?: string;
  authUserId?: string;
};

type RejectionCommentMap = Record<string, string | null>;

type MembershipRow = {
  election_id: string;
  is_verified: boolean;
  has_voted: boolean;
  verification_status: "none" | "pending" | "approved" | "rejected";
  election: {
    id: string;
    title: string;
    description: string | null;
    is_active: boolean;
  } | null;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export async function POST(request: Request) {
  const body = (await request.json()) as ResolveRequest;
  const email = body.email ? normalizeEmail(body.email) : "";
  const authUserId = body.authUserId?.trim() || null;

  if (!email) {
    return NextResponse.json({ error: "Missing email." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const optionalVoterColumns = [
    "mobile_number",
    "school",
    "stream",
    "year_of_study",
    "domain",
    "position",
    "stay",
    "points",
    "vote_points",
    "branch",
    "oat_score",
  ];
  const existingOptionalColumns: string[] = [];

  for (const column of optionalVoterColumns) {
    try {
      const { error: checkError } = await supabase.from("voters").select(column).limit(1);
      if (!checkError) {
        existingOptionalColumns.push(column);
      }
    } catch {
      // Ignore missing columns so the voter portal remains compatible with older schemas.
    }
  }

  const voterSelect = ["id", "registration_number", "name", "email", "auth_user_id", ...existingOptionalColumns].join(
    ", "
  );

  let voter: any = null;
  let voterError: { message: string } | null = null;

  if (authUserId) {
    const authMatch = await supabase.from("voters").select(voterSelect).eq("auth_user_id", authUserId).maybeSingle();
    voter = authMatch.data ?? null;
    voterError = authMatch.error ?? null;
  }

  if (!voter && !voterError) {
    const emailMatch = await supabase.from("voters").select(voterSelect).ilike("email", email).maybeSingle();
    voter = emailMatch.data ?? null;
    voterError = emailMatch.error ?? null;
  }

  if (voterError) {
    return NextResponse.json({ error: voterError.message }, { status: 500 });
  }

  if (!voter) {
    return NextResponse.json({ status: "unregistered" }, { status: 404 });
  }

  if (authUserId && !voter.auth_user_id) {
    await supabase.from("voters").update({ auth_user_id: authUserId }).eq("id", voter.id);
  }

  const { data: electionRows, error: electionError } = await supabase
    .from("election_voters")
    .select(
      "election_id, is_verified, has_voted, election:election_id (id, title, description, is_active)"
    )
    .eq("voter_id", voter.id);

  if (electionError) {
    return NextResponse.json({ error: electionError.message }, { status: 500 });
  }

  const normalizedRows = (electionRows ?? []).map((row) => {
    const election = Array.isArray(row.election) ? row.election[0] ?? null : row.election;
    return {
      election_id: row.election_id,
      is_verified: row.is_verified,
      has_voted: row.has_voted,
      election,
    };
  });

  const { data: verificationRequests, error: verificationError } = await supabase
    .from("verification_requests")
    .select("election_id, status, created_at")
    .eq("voter_id", voter.id)
    .order("created_at", { ascending: false });

  if (verificationError) {
    return NextResponse.json({ error: verificationError.message }, { status: 500 });
  }

  let rejectionLogs: Array<{ election_id: string; metadata: unknown; created_at: string }> = [];
  try {
    const { data, error: rejectionError } = await supabase
      .from("audit_logs")
      .select("election_id, metadata, created_at")
      .eq("action", "verification_rejected")
      .eq("entity", "verification_request")
      .order("created_at", { ascending: false });

    if (!rejectionError) {
      rejectionLogs = data ?? [];
    }
  } catch {
    // audit_logs is optional; keep voter resolve working if the table is missing or stale in cache.
  }

  const latestVerificationByElection = new Map<string, MembershipRow["verification_status"]>();
  for (const requestRow of verificationRequests ?? []) {
    if (!latestVerificationByElection.has(requestRow.election_id)) {
      latestVerificationByElection.set(
        requestRow.election_id,
        requestRow.status === "approved"
          ? "approved"
          : requestRow.status === "pending"
            ? "pending"
            : requestRow.status === "rejected"
              ? "rejected"
              : "none"
      );
    }
  }

  const rejectionCommentByElection: RejectionCommentMap = {};
  for (const logRow of rejectionLogs ?? []) {
    const metadata = (logRow.metadata ?? {}) as Record<string, unknown>;
    if (metadata.voter_id !== voter.id) {
      continue;
    }

    if (!rejectionCommentByElection[logRow.election_id]) {
      const comment = typeof metadata.admin_comment === "string" ? metadata.admin_comment.trim() : "";
      rejectionCommentByElection[logRow.election_id] = comment || null;
    }
  }

  const membershipRows: MembershipRow[] = normalizedRows.map((row) => ({
    ...row,
    verification_status: latestVerificationByElection.get(row.election_id) ?? "none",
  }));

  const activeMembershipRows = membershipRows.filter((row) => row.election?.is_active);
  const inactiveMembershipRows = membershipRows.filter((row) => !row.election?.is_active);
  const approvedActiveMembershipRows = activeMembershipRows.filter(
    (row) => row.verification_status === "approved" && row.is_verified
  );
  const pendingActiveMembershipRows = activeMembershipRows.filter(
    (row) => row.verification_status === "pending"
  );

  const status = activeMembershipRows.length ? "active" : "inactive";

  return NextResponse.json({
    status,
    voter,
    membershipRows,
    activeMembershipRows,
    inactiveMembershipRows,
    approvedActiveMembershipRows,
    pendingActiveMembershipRows,
    rejectionCommentByElection,
  });
}