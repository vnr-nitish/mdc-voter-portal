import "server-only";

import crypto from "crypto";
import { env, requireEnv } from "../env";

const cookieName = "mdc_admin_session";

export type AdminSession = {
  sub: string;
  exp: number;
};

const sign = (payload: AdminSession) => {
  const secret = requireEnv(env.adminSessionSecret, "ADMIN_SESSION_SECRET");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
};

const verify = (token: string) => {
  const secret = env.adminSessionSecret;
  if (!secret) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  const safeEqual = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );

  if (!safeEqual) {
    return null;
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf-8")
  ) as AdminSession;

  if (payload.exp < Date.now()) {
    return null;
  }

  return payload;
};

export const createAdminSession = () => {
  const payload: AdminSession = {
    sub: "admin",
    exp: Date.now() + 1000 * 60 * 60 * 6,
  };

  return {
    token: sign(payload),
    cookieName,
  };
};

export const verifyAdminSession = (token?: string | null) => {
  if (!token) {
    return null;
  }
  return verify(token);
};

export const adminSessionCookie = {
  name: cookieName,
  options: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  },
};
