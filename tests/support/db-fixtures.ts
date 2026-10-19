import type { SupabaseClient } from "@supabase/supabase-js";

/** Ids de uma linha em cada tabela, criada pelo próprio dono (via RLS). */
export type OwnedRows = {
  exercises: string;
  routines: string;
  routine_exercises: string;
  workouts: string;
  workout_exercises: string;
  workout_sets: string;
  body_weights: string;
  meals: string;
  meal_options: string;
  meal_logs: string;
  habits: string;
  habit_logs: string;
  tasks: string;
};

export type TableName = keyof OwnedRows;

/** Ordem de criação: cada tabela só depende das anteriores. */
export const TABLES: TableName[] = [
  "exercises",
  "routines",
  "routine_exercises",
  "workouts",
  "workout_exercises",
  "workout_sets",
  "body_weights",
  "meals",
  "meal_options",
  "meal_logs",
  "habits",
  "habit_logs",
  "tasks",
];

/** Uma alteração inofensiva por tabela, usada para tentar atualizar dados alheios. */
export const PATCHES: Record<TableName, Record<string, unknown>> = {
  exercises: { notes: "alterado" },
  routines: { notes: "alterado" },
  routine_exercises: { notes: "alterado" },
  workouts: { notes: "alterado" },
  workout_exercises: { notes: "alterado" },
  workout_sets: { reps: 99 },
  body_weights: { weight_kg: 99 },
  meals: { name: "alterado" },
  meal_options: { title: "alterado" },
  meal_logs: { note: "alterado" },
  habits: { name: "alterado" },
  habit_logs: { value: 99 },
  tasks: { title: "alterado" },
};

let dayCounter = 0;
/** Dia único por chamada, para não esbarrar nos `unique (user_id, day…)`. */
function uniqueDay(): string {
  dayCounter += 1;
  const d = new Date(Date.UTC(2026, 0, 1 + dayCounter));
  return d.toISOString().slice(0, 10);
}

/**
 * Uma linha válida da tabela, apontando para as linhas-pai já criadas em `parents`.
 * Só a política RLS pode impedir que ela seja gravada.
 */
export function validRow(table: TableName, parents: Partial<OwnedRows>): Record<string, unknown> {
  switch (table) {
    case "exercises":
      return { name: `Supino ${crypto.randomUUID()}` };
    case "routines":
      return { name: "Rotina", position: 1 };
    case "routine_exercises":
      return { routine_id: parents.routines, exercise_id: parents.exercises, position: 1, sets: 3 };
    case "workouts":
      return {
        routine_id: parents.routines,
        started_at: "2026-10-13T10:00:00Z",
        finished_at: "2026-10-13T11:00:00Z",
        day: "2026-10-13",
      };
    case "workout_exercises":
      return { workout_id: parents.workouts, exercise_id: parents.exercises, position: 1 };
    case "workout_sets":
      return { workout_exercise_id: parents.workout_exercises, position: 1, weight_kg: 40, reps: 10 };
    case "body_weights":
      return { day: uniqueDay(), weight_kg: 80.5 };
    case "meals":
      return { name: "Almoço", time: "13:30", position: 1 };
    case "meal_options":
      return {
        meal_id: parents.meals,
        position: 1,
        title: "Opção 1",
        items: [{ name: "Arroz", qty: "100 g", subs: [] }],
      };
    case "meal_logs":
      return { day: uniqueDay(), meal_id: parents.meals, option_id: parents.meal_options };
    case "habits":
      return { name: "Ler", kind: "check", period: "week", target: 3 };
    case "habit_logs":
      return { habit_id: parents.habits, day: "2026-10-13", value: 1 };
    case "tasks":
      return { title: "Comprar whey" };
  }
}

/** Cria uma linha em cada uma das 13 tabelas para o usuário logado em `client`. */
export async function createOwnedRows(client: SupabaseClient): Promise<OwnedRows> {
  const rows: Partial<OwnedRows> = {};
  for (const table of TABLES) {
    const id = crypto.randomUUID();
    const { error } = await client.from(table).insert({ id, ...validRow(table, rows) });
    if (error) throw new Error(`insert em ${table}: ${error.message}`);
    rows[table] = id;
  }
  return rows as OwnedRows;
}
