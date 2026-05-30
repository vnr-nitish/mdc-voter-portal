"use client";

import { createClient } from "@supabase/supabase-js";
import { env, requireEnv } from "../env";

const supabaseUrl = requireEnv(env.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = requireEnv(
  env.supabaseAnonKey,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
);

export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
