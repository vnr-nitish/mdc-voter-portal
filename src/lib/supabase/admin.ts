import "server-only";

import { createClient } from "@supabase/supabase-js";
import { env, requireEnv } from "../env";

export const createAdminSupabaseClient = () => {
  const supabaseUrl = requireEnv(env.supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv(
    env.supabaseServiceRoleKey,
    "SUPABASE_SERVICE_ROLE_KEY"
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};
