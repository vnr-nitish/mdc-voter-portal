import { NextResponse } from "next/server";
import { adminSessionCookie } from "@/lib/admin/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set({
    name: adminSessionCookie.name,
    value: "",
    maxAge: 0,
    path: "/",
  });
  return response;
}
