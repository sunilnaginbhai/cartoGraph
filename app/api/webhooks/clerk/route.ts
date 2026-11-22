import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { createAdminSupabaseClient } from "../../../../lib/supabase/admin";

export async function POST(request: NextRequest) {
  let event;

  try {
    event = await verifyWebhook(request);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  if (event.type === "organization.created") {
    const { error } = await supabase
      .from("organizations")
      .upsert({ id: event.data.id }, { onConflict: "id" });

    if (error) {
      console.error("Clerk organization sync failed", {
        eventType: event.type,
        organizationId: event.data.id,
        code: error.code,
      });
      return new Response("Organization sync failed", { status: 500 });
    }
  }

  if (event.type === "organization.deleted" && event.data.id) {
    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", event.data.id);

    if (error) {
      console.error("Clerk organization deletion sync failed", {
        eventType: event.type,
        organizationId: event.data.id,
        code: error.code,
      });
      return new Response("Organization deletion sync failed", { status: 500 });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}
