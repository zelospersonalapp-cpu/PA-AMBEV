import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await supabase.from("_keep_alive").insert({ nota: "edge function ping" });
  await supabase.from("_keep_alive").delete().lt(
    "ping_at",
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  );

  return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
