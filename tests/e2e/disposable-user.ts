import { createClient } from "@supabase/supabase-js";
import { readLocalSupabaseEnv } from "../support/local-supabase";

/**
 * Usuário descartável no Supabase LOCAL, para E2E que gravam dados.
 * Assim o usuário do seed (`e2e@bctrl.test`) continua com as contagens que
 * `tests/integration/seed.test.ts` confere. Os dados somem com o usuário (cascata).
 */
export type DisposableUser = { id: string; email: string; password: string };

function admin() {
  const { url, secretKey } = readLocalSupabaseEnv();
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function createDisposableUser(label: string): Promise<DisposableUser> {
  const email = `${label}-${crypto.randomUUID()}@bctrl.test`;
  const password = `senha-${crypto.randomUUID()}`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("usuário não criado");
  return { id: data.user.id, email, password };
}

export async function deleteDisposableUser(user: DisposableUser | undefined) {
  if (!user) return;
  const { error } = await admin().auth.admin.deleteUser(user.id);
  if (error) throw error;
}

export type TrainingPlan = { upper: string; lower: string };

/**
 * Plano mínimo para a sessão de treino: Upper E2E (supino + remada) e Lower E2E (agachamento),
 * com 2 treinos já finalizados (Upper e depois Lower). Assim o próximo sugerido é o Upper
 * (volta do fim da sequência para o início) e o supino tem "anterior" 40 × 10 e 40 × 8.
 */
export async function seedTrainingPlan(user: DisposableUser): Promise<TrainingPlan> {
  const db = admin();
  const user_id = user.id;
  const id = () => crypto.randomUUID();
  const ex = { supino: id(), remada: id(), agachamento: id() };
  const routine = { upper: id(), lower: id() };

  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    const { error } = await db.from(table).insert(rows.map((r) => ({ user_id, ...r })));
    if (error) throw new Error(`seed ${table}: ${error.message}`);
  };

  await insert("exercises", [
    { id: ex.supino, name: "Supino E2E", muscle_group: "Peito" },
    { id: ex.remada, name: "Remada E2E", muscle_group: "Costas" },
    { id: ex.agachamento, name: "Agachamento E2E", muscle_group: "Quadríceps" },
  ]);
  await insert("routines", [
    { id: routine.upper, name: "Upper E2E", position: 1, rest_sec: 120 },
    { id: routine.lower, name: "Lower E2E", position: 2, rest_sec: 120 },
  ]);
  await insert("routine_exercises", [
    { routine_id: routine.upper, exercise_id: ex.supino, position: 1, sets: 2, rest_sec: 60, notes: "Escápulas encaixadas" },
    { routine_id: routine.upper, exercise_id: ex.remada, position: 2, sets: 1 },
    { routine_id: routine.lower, exercise_id: ex.agachamento, position: 1, sets: 2, rest_sec: 90 },
  ]);

  const workouts = [
    { routine: routine.upper, day: "2026-10-12", sets: [[ex.supino, [[40, 10], [40, 8]]], [ex.remada, [[30, 12]]]] },
    { routine: routine.lower, day: "2026-10-13", sets: [[ex.agachamento, [[60, 10], [60, 10]]]] },
  ] as const;
  for (const w of workouts) {
    const workoutId = id();
    await insert("workouts", [
      {
        id: workoutId,
        routine_id: w.routine,
        day: w.day,
        started_at: `${w.day}T13:00:00Z`,
        finished_at: `${w.day}T14:00:00Z`,
      },
    ]);
    for (const [position, [exerciseId, sets]] of w.sets.entries()) {
      const weId = id();
      await insert("workout_exercises", [
        { id: weId, workout_id: workoutId, exercise_id: exerciseId, position: position + 1 },
      ]);
      await insert(
        "workout_sets",
        sets.map(([weight_kg, reps], i) => ({ workout_exercise_id: weId, position: i + 1, weight_kg, reps })),
      );
    }
  }
  return routine;
}
