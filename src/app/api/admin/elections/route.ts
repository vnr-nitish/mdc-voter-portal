import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  return verifyAdminSession(token);
};

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("elections")
    .select("id, title, description, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const uniqueElections = (data ?? []).reduce<typeof data>((accumulator, election) => {
    const normalizedTitle = election.title.trim().toLowerCase();
    const existingIndex = accumulator.findIndex(
      (item) => item.title.trim().toLowerCase() === normalizedTitle
    );

    if (existingIndex >= 0) {
      const existing = accumulator[existingIndex];
      if (new Date(election.created_at).getTime() > new Date(existing.created_at).getTime()) {
        accumulator[existingIndex] = election;
      }
      return accumulator;
    }

    accumulator.push(election);
    return accumulator;
  }, []);

  return NextResponse.json({ elections: uniqueElections });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, is_active } = await request.json();
  const normalizedTitle = String(title ?? "").trim();
  if (!normalizedTitle) {
    return NextResponse.json({ error: "Election title is required." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: existingElection, error: existingError } = await supabase
    .from("elections")
    .select("id, title, description, is_active, created_at")
    .eq("title", normalizedTitle)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existingElection) {
    const { data: updatedElection, error: updateError } = await supabase
      .from("elections")
      .update({
        description: description ? String(description).trim() : null,
        is_active: typeof is_active === "boolean" ? is_active : true,
      })
      .eq("id", existingElection.id)
      .select("id, title, description, is_active, created_at")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ election: updatedElection, created: false });
  }

  const { data, error } = await supabase
    .from("elections")
    .insert({
      title: normalizedTitle,
      description: description ? String(description).trim() : null,
      is_active: typeof is_active === "boolean" ? is_active : true,
    })
    .select("id, title, description, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ election: data, created: true });
}
