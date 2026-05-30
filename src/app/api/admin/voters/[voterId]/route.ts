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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ voterId: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { voterId } = await params;
  const body = await request.json();
  const updates = body;
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("voters").update(updates).eq("id", voterId).select("id, registration_number, name, email, mobile_number").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ voter: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ voterId: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { voterId } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: voterBeforeDelete } = await supabase
    .from("voters")
    .select("id, registration_number, name, email")
    .eq("id", voterId)
    .maybeSingle();

  const { error } = await supabase.from("voters").delete().eq("id", voterId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    await supabase.from("audit_logs").insert({
      action: "voter_deleted",
      entity: "voter",
      entity_id: voterId,
      actor: session.sub,
      metadata: { ...(voterBeforeDelete ?? {}), admin_username: env.adminUsername ?? null },
    });
  } catch {
    // best-effort
  }

  return NextResponse.json({ success: true });
}
