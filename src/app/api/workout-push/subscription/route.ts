import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2_048),
  keys: z.object({
    p256dh: z.string().min(40).max(256),
    auth: z.string().min(16).max(128),
  }),
});

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { response: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  return { supabase, user: data.user };
}

export async function POST(request: Request) {
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Assinatura push inválida." }, { status: 400 });

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { endpoint, keys } = parsed.data;
  const { error } = await auth.supabase.from("workout_push_subscriptions").upsert(
    {
      user_id: auth.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) {
    console.error("[workout-push] Falha ao salvar assinatura.", error.code);
    return Response.json({ error: "Não foi possível salvar este aparelho." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const parsed = z.object({ endpoint: z.string().url().max(2_048) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Assinatura inválida." }, { status: 400 });

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { error } = await auth.supabase
    .from("workout_push_subscriptions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error) {
    console.error("[workout-push] Falha ao remover assinatura.", error.code);
    return Response.json({ error: "Não foi possível desativar este aparelho." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
