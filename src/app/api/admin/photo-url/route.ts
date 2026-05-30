import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminSessionCookie, verifyAdminSession } from "@/lib/admin/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  const store = await cookies();
  const token = store.get(adminSessionCookie.name)?.value;
  const session = verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await request.json();
  if (!path) {
    return NextResponse.json({ error: "Missing path." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.storage
    .from(env.storageBucket)
    .createSignedUrl(path, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Unable to sign URL." }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
