import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

type RequiredSupabaseEnvironment =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function environmentValue(name: RequiredSupabaseEnvironment) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} must be set before starting Cartograph.`);
  }

  return value;
}

export function createServerSupabaseClient() {
  return createClient(
    environmentValue("NEXT_PUBLIC_SUPABASE_URL"),
    environmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      async accessToken() {
        return (await auth()).getToken();
      },
    },
  );
}
