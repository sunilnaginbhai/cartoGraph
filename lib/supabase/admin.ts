import "server-only";

import { createClient } from "@supabase/supabase-js";

type RequiredAdminEnvironment =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SECRET_KEY";

function environmentValue(name: RequiredAdminEnvironment) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set before starting Cartograph.`);
  }

  return value;
}

export function createAdminSupabaseClient() {
  return createClient(
    environmentValue("NEXT_PUBLIC_SUPABASE_URL"),
    environmentValue("SUPABASE_SECRET_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
