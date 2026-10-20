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

/** Linhas do usuário numa tabela (leitura direta no banco, para conferir gravações). */
export async function countRows(user: DisposableUser, table: string) {
  const { count, error } = await admin().from(table).select("*", { count: "exact", head: true }).eq("user_id", user.id);
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
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

export type TypedPlan = { routine: string; exercises: { prancha: string; corrida: string; supino: string } };

/**
 * v2: rotina com um exercício de cada família de tipo (duração, distância × duração e
 * carga × reps), sem descanso (o timer não cobre a tela). O supino tem um treino anterior
 * (40 × 10), então uma série de trabalho acima disso seria PR.
 */
export async function seedTypedPlan(user: DisposableUser): Promise<TypedPlan> {
  const insert = inserter(user);
  const id = () => crypto.randomUUID();
  const ex = { prancha: id(), corrida: id(), supino: id() };
  const routine = id();
  await insert("exercises", [
    { id: ex.prancha, name: "Prancha E2E", muscle_group: "Abdômen", exercise_type: "duration" },
    { id: ex.corrida, name: "Corrida E2E", muscle_group: "Cardio", exercise_type: "distance_duration" },
    { id: ex.supino, name: "Supino Tipos E2E", muscle_group: "Peito", exercise_type: "weight_reps" },
  ]);
  await insert("routines", [{ id: routine, name: "Tipos E2E", position: 1, rest_sec: 0 }]);
  await insert("routine_exercises", [
    { routine_id: routine, exercise_id: ex.prancha, position: 1, sets: 1, rest_sec: 0 },
    { routine_id: routine, exercise_id: ex.corrida, position: 2, sets: 1, rest_sec: 0 },
    { routine_id: routine, exercise_id: ex.supino, position: 3, sets: 2, rest_sec: 0 },
  ]);
  await seedWorkout(user, { day: "2026-10-12", sets: [[ex.supino, [[40, 10]]]] }, insert);
  return { routine, exercises: ex };
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

export type SystemHabitIds = { cardio: string; abs: string; supplements: string };

/** Os hábitos do sistema, iguais aos do seed (o "Treino" vem dos workouts). */
export async function seedSystemHabits(user: DisposableUser): Promise<SystemHabitIds> {
  const id = () => crypto.randomUUID();
  const ids: SystemHabitIds = { cardio: id(), abs: id(), supplements: id() };
  await inserter(user)("habits", [
    { id: ids.cardio, name: "Cardio", kind: "cardio", period: "week", target: 150, unit: "min", system_key: "cardio" },
    { id: ids.abs, name: "Abdominal", kind: "check", period: "week", target: 3, unit: null, system_key: "abs" },
    { id: ids.supplements, name: "Desjejum/Suplementos", kind: "check", period: "day", target: 1, unit: null, system_key: "supplements" },
  ]);
  return ids;
}

export type CatalogSeed = { routine: string; exercises: { supinoHalter: string; remada: string } };

/** Links de mídia no formato do CDN do Hevy (os testes interceptam esses hosts). */
export const CATALOG_MEDIA = {
  thumb: (slug: string) => `https://pump-app.s3.eu-west-2.amazonaws.com/exercise-thumbnails/e2e-${slug}.jpg`,
  video: (slug: string) => `https://d2l9nsnmtah87f.cloudfront.net/exercise-assets/e2e-${slug}.mp4`,
};

/**
 * v2: catálogo com mídia por link, instruções e filtros. Peito + Halter casa só 2 exercícios;
 * 45 puxadas de enchimento passam do primeiro bloco da lista (40) para testar "Mostrar mais".
 * A rotina tem a remada, que tem instruções, para a sessão mostrar o bloco recolhido.
 */
export async function seedCatalog(user: DisposableUser): Promise<CatalogSeed> {
  const insert = inserter(user);
  const id = () => crypto.randomUUID();
  const ex = { supinoHalter: id(), remada: id() };
  const routine = id();
  const media = (slug: string) => ({
    thumbnail_url: CATALOG_MEDIA.thumb(slug),
    media_url: CATALOG_MEDIA.video(slug),
    source: "hevy",
  });
  // Todas as linhas com as mesmas colunas: o insert em lote não pode deixar `source` nulo.
  const row = (rowId: string, name: string, muscle_group: string, equipment: string, extra: Record<string, unknown> = {}) => ({
    id: rowId,
    name,
    muscle_group,
    equipment,
    secondary_muscles: [],
    thumbnail_url: null,
    media_url: null,
    instructions: null,
    source: "bctrl",
    ...extra,
  });
  await insert("exercises", [
    row(ex.supinoHalter, "Supino Catálogo (Halter)", "Peito", "Halter", {
      ...media("supino"),
      secondary_muscles: ["Tríceps", "Ombros"],
      instructions: "Posição: deitado no banco.\nExecução: empurre os halteres.\nRespiração: solte o ar ao subir.",
    }),
    row(id(), "Crucifixo Catálogo (Halter)", "Peito", "Halter", media("crucifixo")),
    row(id(), "Supino Catálogo (Barra)", "Peito", "Barra", media("supino-barra")),
    row(ex.remada, "Remada Catálogo (Halter)", "Costas", "Halter", {
      ...media("remada"),
      instructions: "Posição: tronco inclinado.\nExecução: puxe os halteres até a cintura.",
    }),
    ...Array.from({ length: 45 }, (_, i) => row(id(), `Puxada Enchimento ${String(i + 1).padStart(2, "0")}`, "Costas", "Máquina")),
  ]);
  await insert("routines", [{ id: routine, name: "Rotina Catálogo", position: 1, rest_sec: 0 }]);
  await insert("routine_exercises", [{ routine_id: routine, exercise_id: ex.remada, position: 1, sets: 1, rest_sec: 0 }]);
  return { routine, exercises: ex };
}
