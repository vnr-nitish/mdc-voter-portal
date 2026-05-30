import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type CandidateRow = {
  id: string;
  election_id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  photo_url: string | null;
  manifesto: string | null;
};

type CandidateAuditFallback = {
  entity_id: string | null;
  metadata: {
    email?: string | null;
    phone_number?: string | null;
    manifesto?: string | null;
    photo_url?: string | null;
  } | null;
  created_at: string;
};

const toSignedIfNeeded = async (
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  value: string | null
) => {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let path = raw;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const marker = "/storage/v1/object/public/voter-photos/";
      const index = parsed.pathname.indexOf(marker);
      if (index < 0) {
        return raw;
      }
      path = parsed.pathname.slice(index + marker.length);
    } catch {
      return raw;
    }
  }

  const { data, error } = await supabase.storage
    .from("voter-photos")
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const electionId = searchParams.get("electionId")?.trim();
  if (!electionId) {
    return NextResponse.json({ error: "Missing electionId." }, { status: 400 });
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
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (voterError || !voter) {
    return NextResponse.json({ error: "Voter not found." }, { status: 404 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("election_voters")
    .select("id, is_verified")
    .eq("election_id", electionId)
    .eq("voter_id", voter.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Unauthorized for election." }, { status: 403 });
  }

  const candidateSelectAttempts = [
    "*",
    "id, election_id, name, email, phone_number, photo_url, manifesto, created_at",
    "id, election_id, name, phone_number, photo_url, manifesto, created_at",
    "id, election_id, name, photo_url, manifesto, created_at",
    "id, election_id, name, created_at",
  ];

  let candidates: any[] = [];
  for (const candidateSelect of candidateSelectAttempts) {
    const { data, error } = await supabase
      .from("candidates")
      .select(candidateSelect)
      .eq("election_id", electionId)
      .order("created_at", { ascending: true });

    if (!error) {
      candidates = data ?? [];
      break;
    }

    const message = error.message.toLowerCase();
    const isMissingColumn =
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("could not find the 'email' column") ||
      message.includes("could not find the 'phone_number' column") ||
      message.includes("could not find the 'manifesto' column") ||
      message.includes("could not find the 'photo_url' column");

    if (!isMissingColumn) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const withSignedPhotos: CandidateRow[] = await Promise.all(
    (candidates ?? []).map(async (candidate: any) => ({
      id: candidate.id,
      election_id: candidate.election_id,
      name: candidate.name,
      email: candidate.email ?? null,
      phone_number: candidate.phone_number ?? null,
      manifesto: candidate.manifesto ?? null,
      photo_url: await toSignedIfNeeded(supabase, candidate.photo_url ?? null),
    }))
  );

  const missingContacts = withSignedPhotos.some((candidate) => !candidate.email || !candidate.phone_number);
  if (missingContacts) {
    const candidateIds = withSignedPhotos.map((candidate) => candidate.id);
    const { data: auditRows } = await supabase
      .from("audit_logs")
      .select("entity_id, metadata, created_at")
      .eq("entity", "candidate")
      .eq("election_id", electionId)
      .in("entity_id", candidateIds)
      .order("created_at", { ascending: false })
      .limit(200);

    const auditByCandidate = new Map<string, CandidateAuditFallback>();
    (auditRows ?? []).forEach((row: CandidateAuditFallback) => {
      if (row.entity_id && !auditByCandidate.has(row.entity_id)) {
        auditByCandidate.set(row.entity_id, row);
      }
    });

    withSignedPhotos.forEach((candidate, index) => {
      if (!candidate.email || !candidate.phone_number) {
        const fallback = auditByCandidate.get(candidate.id);
        const metadata = fallback?.metadata ?? null;
        withSignedPhotos[index] = {
          ...candidate,
          email: candidate.email ?? metadata?.email ?? null,
          phone_number: candidate.phone_number ?? metadata?.phone_number ?? null,
          manifesto: candidate.manifesto ?? metadata?.manifesto ?? null,
          photo_url: candidate.photo_url ?? (metadata?.photo_url ? metadata.photo_url : null),
        };
      }
    });
  }

  return NextResponse.json({ candidates: withSignedPhotos });
}
