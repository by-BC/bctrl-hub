import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const restJobSchema = z.object({
  workoutId: z.string().uuid(),
  endsAt: z.string().datetime(),
  exerciseName: z.string().trim().min(1).max(120),
  nextSetNumber: z.number().int().min(1).max(100).optional(),
});

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { response: Response.json({ error: "Não autenticado." }, { status: 401 }) };
  return { supabase, user: data.user };
}

export async function POST(request: Request) {
  const parsed = restJobSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Aviso de descanso inválido." }, { status: 400 });

  const now = Date.now();
  const endsAt = Date.parse(parsed.data.endsAt);
  if (!Number.isFinite(endsAt) || endsAt < now - 60_000 || endsAt > now + 3 * 60 * 60_000) {
    return Response.json({ error: "O horário do descanso está fora do limite permitido." }, { status: 400 });
  }

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { workoutId, exerciseName, nextSetNumber } = parsed.data;
  const { error } = await auth.supabase.from("workout_rest_push_jobs").upsert(
    {
      user_id: auth.user.id,
      workout_id: workoutId,
      ends_at: new Date(endsAt).toISOString(),
      next_attempt_at: new Date(endsAt).toISOString(),
      exercise_name: exerciseName,
      next_set_number: nextSetNumber ?? null,
      status: "pending",
      attempt_count: 0,
      locked_until: null,
    },
    { onConflict: "user_id,workout_id" },
  );
  if (error) {
    console.error("[workout-push] Falha ao agendar descanso.", error.code);
    return Response.json({ error: "Não foi possível agendar o aviso." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}

export async function DELETE(request: Request) {
  const parsed = z.object({ workoutId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Treino inválido." }, { status: 400 });

  const auth = await getAuthenticatedClient();
  if ("response" in auth) return auth.response;

  const { error } = await auth.supabase
    .from("workout_rest_push_jobs")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("workout_id", parsed.data.workoutId);
  if (error) {
    console.error("[workout-push] Falha ao cancelar descanso.", error.code);
    return Response.json({ error: "Não foi possível cancelar o aviso." }, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
