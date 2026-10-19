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

export type TrainingPlan = {
  upper: string;
  lower: string;
  exercises: { supino: string; remada: string; agachamento: string };
};

/** [kg, reps] ou [kg, reps, prs]. */
type SeedSet = readonly [number, number] | readonly [number, number, readonly string[]];

type Insert = (table: string, rows: Record<string, unknown>[]) => Promise<void>;

function inserter(user: DisposableUser): Insert {
  const db = admin();
  return async (table, rows) => {
    const { error } = await db.from(table).insert(rows.map((r) => ({ user_id: user.id, ...r })));
    if (error) throw new Error(`seed ${table}: ${error.message}`);
  };
}

/** Exercício sem histórico. */
export async function seedExercise(user: DisposableUser, name: string) {
  const id = crypto.randomUUID();
  await inserter(user)("exercises", [{ id, name }]);
  return id;
}

/** Treino finalizado direto no banco: `sets` = [exercício, [[kg, reps, prs?], …]] na ordem. */
export async function seedWorkout(
  user: DisposableUser,
  w: {
    routine?: string | null;
    day: string;
    sets: readonly (readonly [string, readonly SeedSet[]])[];
  },
  insert: Insert = inserter(user),
) {
  const workoutId = crypto.randomUUID();
  await insert("workouts", [
    {
      id: workoutId,
      routine_id: w.routine ?? null,
      day: w.day,
      started_at: `${w.day}T13:00:00Z`,
      finished_at: `${w.day}T14:00:00Z`,
    },
  ]);
  for (const [position, [exerciseId, sets]] of w.sets.entries()) {
    const weId = crypto.randomUUID();
    await insert("workout_exercises", [{ id: weId, workout_id: workoutId, exercise_id: exerciseId, position: position + 1 }]);
    await insert(
      "workout_sets",
      sets.map(([weight_kg, reps, pr_kinds = []]: readonly [number, number, (readonly string[])?], i) => ({
        workout_exercise_id: weId,
        position: i + 1,
        weight_kg,
        reps,
        pr_kinds,
      })),
    );
  }
  return workoutId;
}

/**
 * Plano mínimo para a sessão de treino: Upper E2E (supino + remada) e Lower E2E (agachamento),
 * com 2 treinos já finalizados (Upper e depois Lower). Assim o próximo sugerido é o Upper
 * (volta do fim da sequência para o início) e o supino tem "anterior" 40 × 10 e 40 × 8.
 */
export async function seedTrainingPlan(user: DisposableUser): Promise<TrainingPlan> {
  const insert = inserter(user);
  const id = () => crypto.randomUUID();
  const ex = { supino: id(), remada: id(), agachamento: id() };
  const routine = { upper: id(), lower: id() };

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

  await seedWorkout(
    user,
    { routine: routine.upper, day: "2026-10-12", sets: [[ex.supino, [[40, 10], [40, 8]]], [ex.remada, [[30, 12]]]] },
    insert,
  );
  await seedWorkout(user, { routine: routine.lower, day: "2026-10-13", sets: [[ex.agachamento, [[60, 10], [60, 10]]]] }, insert);
  return { ...routine, exercises: ex };
}

export type MealPlanIds = { cafe: string; almoco: string; pos: string; jantar: string };

/**
 * Plano alimentar mínimo: café (2 opções), almoço, pós-treino (só em dia de treino, sem
 * horário, na posição 3) e jantar (2 opções). Sem treino, o dia prevê 3 refeições.
 */
export async function seedMealPlan(user: DisposableUser): Promise<MealPlanIds> {
  const insert = inserter(user);
  const id = () => crypto.randomUUID();
  const meals: MealPlanIds = { cafe: id(), almoco: id(), pos: id(), jantar: id() };
  await insert("meals", [
    { id: meals.cafe, name: "Café da manhã", time: "08:30", position: 1, training_day_only: false },
    { id: meals.almoco, name: "Almoço", time: "12:30", position: 2, training_day_only: false },
    { id: meals.pos, name: "Pós-treino", time: null, position: 3, training_day_only: true },
    { id: meals.jantar, name: "Jantar", time: "19:30", position: 4, training_day_only: false },
  ]);
  const item = (name: string, qty: string, subs: string[] = []) => ({ name, qty, subs });
  await insert("meal_options", [
    { meal_id: meals.cafe, position: 1, title: "Tapioca", items: [item("Tapioca", "40 g", ["Cuscuz 60 g"]), item("Queijo branco", "30 g")] },
    { meal_id: meals.cafe, position: 2, title: "Iogurte", items: [item("Iogurte natural", "170 g"), item("Granola", "30 g", ["Aveia 30 g"])] },
    { meal_id: meals.almoco, position: 1, title: "Prato feito", items: [item("Arroz", "150 g"), item("Frango", "120 g", ["Peixe 150 g"])] },
    { meal_id: meals.pos, position: 1, title: "Vitamina", items: [item("Leite", "250 ml"), item("Banana", "1 un")] },
    { meal_id: meals.jantar, position: 1, title: "Omelete", items: [item("Ovos", "3 un")] },
    { meal_id: meals.jantar, position: 2, title: "Sopa", items: [item("Sopa de legumes", "400 ml")] },
  ]);
  return meals;
}
