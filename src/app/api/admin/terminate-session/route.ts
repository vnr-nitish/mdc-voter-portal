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

  // Best-effort: if this session belongs to a voter with an auth user, revoke their
  // auth sessions/refresh tokens so they are immediately signed out.
  try {
    const { data: sessionRow, error: sessionFetchError } = await supabase
      .from('sessions')
      .select('voter_id')
      .eq('id', sessionId)
      .maybeSingle();

    if (!sessionFetchError && sessionRow?.voter_id) {
      const { data: voter, error: voterError } = await supabase
        .from('voters')
        .select('auth_user_id')
        .eq('id', sessionRow.voter_id)
        .maybeSingle();

      const authUserId = voter?.auth_user_id ?? null;
      if (!voterError && authUserId) {
        // delete auth refresh tokens and sessions for the user (service role)
        try {
          await supabase.from('auth.refresh_tokens').delete().eq('user_id', authUserId);
        } catch (e) {
          // ignore errors here; best-effort
        }

        try {
          await supabase.from('auth.sessions').delete().eq('user_id', authUserId);
        } catch (e) {
          // ignore errors here; best-effort
        }
      }
    }
  } catch (e) {
    // ignore; we already performed the primary action
  }

  return NextResponse.json({ ok: true });
}
