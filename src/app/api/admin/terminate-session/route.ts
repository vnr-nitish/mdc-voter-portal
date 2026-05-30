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

  const { sessionId } = await request.json();
  if (!sessionId) {
    return NextResponse.json({ error: "Missing sessionId." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("sessions")
    .update({ is_active: false })
    .eq("id", sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
