import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const rows = (body.rows ?? []) as Array<Record<string, string>>;
  const electionId = body.electionId as string | undefined;

  if (!electionId) {
    return NextResponse.json({ error: "Missing electionId." }, { status: 400 });
  }

  if (!rows.length) {
    return NextResponse.json({ error: "No rows provided." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: election, error: electionError } = await supabase
    .from("elections")
    .select("id")
    .eq("id", electionId)
    .single();

  if (electionError || !election) {
    return NextResponse.json({ error: "Election not found." }, { status: 404 });
  }

  const normalizedRows = rows.map((row) => ({
    registration_number: row.registration_number ?? row.registrationNumber ?? "",
    name: row.name ?? "",
    email: (row.email ?? row.email_id ?? row.emailid ?? "").trim().toLowerCase(),
    mobile_number: row.mobile_number ?? row.mobileNumber ?? null,
    school: row.school ?? null,
    stream: row.stream ?? null,
    domain: row.domain ?? null,
    position: row.position ?? row.postion ?? null,
    stay: row.stay ?? null,
    branch: row.branch ?? row.school ?? row.stream ?? null,
    year_of_study: row.year_of_study ?? row.yearofstudy ?? null,
    oat_score: row.oat_score ?? row.points ?? row.value_of_vote ?? row.valueofthevote ?? null,
    points: Number(row.points ?? row.vote_points ?? row.value_of_vote ?? row.valueofthevote ?? 1) || 1,
    vote_points: Number(row.points ?? row.vote_points ?? row.value_of_vote ?? row.valueofthevote ?? 1) || 1,
  }));

  // Determine which optional columns actually exist in the DB (service-role
  // client) to avoid errors when a deployed DB hasn't been migrated yet.
  const optionalCols = [
    "mobile_number",
    "school",
    "stream",
    "domain",
    "position",
    "stay",
    "branch",
    "year_of_study",
    "oat_score",
    "points",
    "vote_points",
  ];
  const existingOptional: string[] = [];

  for (const col of optionalCols) {
    try {
      // Try selecting the column; if it doesn't exist Postgres will error.
      const { error: checkErr } = await supabase
        .from("voters")
        .select(col)
        .limit(1);
      if (!checkErr) existingOptional.push(col);
    } catch {
      // ignore — column likely doesn't exist
    }
  }

  const allowedCols = new Set([
    "registration_number",
    "name",
    "email",
    ...existingOptional,
  ]);

  const sanitized = normalizedRows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => allowedCols.has(k)))
  );

  const { error } = await supabase.from("voters").upsert(sanitized, { onConflict: "registration_number" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const registrationNumbers = normalizedRows
    .map((row) => row.registration_number)
    .filter((value): value is string => Boolean(value));

  if (registrationNumbers.length) {
    const { data: importedVoters, error: votersError } = await supabase
      .from("voters")
      .select("id")
      .in("registration_number", registrationNumbers);

    if (votersError) {
      return NextResponse.json({ error: votersError.message }, { status: 500 });
    }

    if (importedVoters?.length) {
      const { error: linkError } = await supabase.from("election_voters").upsert(
        importedVoters.map((voter) => ({
          election_id: electionId,
          voter_id: voter.id,
        })),
        { onConflict: "election_id,voter_id" }
      );

      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, imported: normalizedRows.length });
}
