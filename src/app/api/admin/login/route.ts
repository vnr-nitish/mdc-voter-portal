import { NextResponse } from "next/server";
import { env, requireEnv } from "@/lib/env";
import { adminSessionCookie, createAdminSession } from "@/lib/admin/session";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const adminUsername = requireEnv(env.adminUsername, "ADMIN_USERNAME");
    const adminPassword = requireEnv(env.adminPassword, "ADMIN_PASSWORD");

    if (username !== adminUsername || password !== adminPassword) {
      return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
    }

    const { token } = createAdminSession();
    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: adminSessionCookie.name,
      value: token,
      ...adminSessionCookie.options,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
