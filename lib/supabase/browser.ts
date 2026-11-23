"use client";
import { createClient } from "@supabase/supabase-js";
export function createBrowserSupabaseClient(accessToken: () => Promise<string | null>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase browser environment is not configured.");
  return createClient(url, key, { accessToken });
}
