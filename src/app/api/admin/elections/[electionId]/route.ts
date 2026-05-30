import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

const requireAdmin = async () => {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  return verifyAdminSession(token);
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ electionId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { electionId } = await params;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("elections")
    .select("id, title, description, is_active, created_at")
    .eq("id", electionId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ election: data });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ electionId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { electionId } = await params;
  const body = await request.json();
  const title = body.title ? String(body.title).trim() : "";
  const description = body.description ? String(body.description).trim() : null;
  const is_active = typeof body.is_active === "boolean" ? body.is_active : undefined;

  if (!title) {
    return NextResponse.json({ error: "Election title is required." }, { status: 400 });
  }

  const updates: Record<string, string | boolean | null> = {
    title,
    description,
  };

  if (typeof is_active === "boolean") {
    updates.is_active = is_active;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("elections")
    .update(updates)
    .eq("id", electionId)
    .select("id, title, description, is_active, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ election: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { electionId } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: electionBeforeDelete } = await supabase
    .from("elections")
    .select("id, title, description, is_active")
    .eq("id", electionId)
    .maybeSingle();

  const { error } = await supabase.from("elections").delete().eq("id", electionId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await supabase.from("audit_logs").insert({
      action: "election_deleted",
      entity: "election",
      entity_id: electionId,
      election_id: electionId,
      actor: session.sub,
      metadata: { ...(electionBeforeDelete ?? {}), admin_username: env.adminUsername ?? null },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ success: true });
}