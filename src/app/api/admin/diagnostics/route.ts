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

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : String(error);
};

export async function GET(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId") || null;

  const columnExists = async (table: string, column: string) => {
    try {
      const { error } = await supabase.from(table).select(column).limit(1);
      if (!error) return { exists: true };
      const msg = (error.message || "").toLowerCase();
      const isMissing = msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find");
      return { exists: false, error: isMissing ? null : error.message };
    } catch (err: unknown) {
      return { exists: false, error: getErrorMessage(err) };
    }
  };

  const votesPoints = await columnExists("votes", "points");
  const votersOat = await columnExists("voters", "oat_score");

  // Try to obtain a sample vote row (best-effort)
  const voteSelectAttempts = [
    "id, reason, points, created_at, candidate_id, candidate:candidate_id (id, name), voter:voter_id (id, name, registration_number, oat_score, vote_points)",
    "id, reason, created_at, candidate_id, candidate:candidate_id (id, name), voter:voter_id (id, name, registration_number, oat_score, vote_points)",
    "id, reason, created_at, candidate_id, candidate:candidate_id (id, name), voter:voter_id (id, name, registration_number, vote_points)",
  ];

  let sampleVotes: unknown[] = [];
  try {
    for (const sel of voteSelectAttempts) {
      const { data, error } = await supabase
        .from("votes")
        .select(sel)
        .order("created_at", { ascending: false })
        .limit(5);
      if (!error) {
        sampleVotes = data ?? [];
        break;
      }
      const msg = (error.message || "").toLowerCase();
      const isSchema = msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find");
      if (!isSchema) {
        // unexpected error
        sampleVotes = [{ error: error.message }];
        break;
      }
      // otherwise continue trying
    }
  } catch (err: unknown) {
    sampleVotes = [{ error: getErrorMessage(err) }];
  }

  // Try to obtain a sample voter row
  let sampleVoters: unknown[] = [];
  try {
    const voterSelects = ["id, name, registration_number, oat_score, vote_points", "id, name, registration_number, vote_points", "id, name, registration_number"];
    for (const sel of voterSelects) {
      const { data, error } = await supabase.from("voters").select(sel).limit(5);
      if (!error) {
        sampleVoters = data ?? [];
        break;
      }
      const msg = (error.message || "").toLowerCase();
      const isSchema = msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find");
      if (!isSchema) {
        sampleVoters = [{ error: error.message }];
        break;
      }
    }
  } catch (err: unknown) {
    sampleVoters = [{ error: getErrorMessage(err) }];
  }

  return NextResponse.json({
    electionId,
    columns: {
      votes: { points: votesPoints.exists, error: votesPoints.error ?? null },
      voters: { oat_score: votersOat.exists, error: votersOat.error ?? null },
    },
    sampleVotes,
    sampleVoters,
  });
}
