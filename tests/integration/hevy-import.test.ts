import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ptFixture from "../fixtures/hevy/catalog-pt.json";
import templatesFixture from "../fixtures/hevy/exercise_templates.json";
import workoutsFixture from "../fixtures/hevy/workouts.json";
import { buildImportSql, planImport, type HevyTemplate, type HevyWorkout, type PtCatalog } from "../../scripts/hevy/map";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Importação do Hevy (task 2.0 v2): o SQL gerado a partir dos fixtures é aplicado duas
 * vezes no Supabase LOCAL, para um usuário descartável que já tem exercícios e um treino da v1.
 */

let owner: TestUser;
let dir: string;
let sqlFile: string;
const existingId = crypto.randomUUID(); // "Supino Reto (Barra)": vínculo exato
const otherId = crypto.randomUUID(); // "Remada unilateral": vínculo por override
const v1WorkoutId = crypto.randomUUID();

/** Aplica o arquivo no banco local com a mesma CLI usada no remoto (sem --linked). */
function applySql(file: string) {
  // Caminho gerado por mkdtemp (sem entrada externa).
  execSync(`npx supabase db query --local -f "${file}"`, { stdio: ["ignore", "ignore", "pipe"] });
}

async function counts(userId: string) {
  const db = adminClient();
  const count = async (table: string, source?: string) => {
    let query = db.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId);
    if (source) query = query.eq("source", source);
    const { count: n, error } = await query;
    if (error) throw error;
    return n;
  };
  return {
    exercises: await count("exercises"),
    workouts: await count("workouts"),
    hevyWorkouts: await count("workouts", "hevy"),
    workoutExercises: await count("workout_exercises"),
    sets: await count("workout_sets"),
  };
}

beforeAll(async () => {
  owner = await createTestUser("hevy-import");
  const c = owner.client;
  const must = async (op: PromiseLike<{ error: unknown }>) => {
    const { error } = await op;
    if (error) throw new Error(JSON.stringify(error));
  };
  await must(
    c.from("exercises").insert([
      { id: existingId, name: "Supino Reto (Barra)", muscle_group: "Peito" },
      { id: otherId, name: "Remada unilateral", muscle_group: "Costas" },
    ]),
  );
  // Treino da v1 no exercício que será vinculado: precisa continuar ligado ao mesmo id.
  await must(
    c.rpc("finish_workout", {
      payload: {
        id: v1WorkoutId,
        routine_id: null,
        started_at: "2026-10-01T10:00:00Z",
        finished_at: "2026-10-01T11:00:00Z",
        day: "2026-10-01",
        notes: null,
        exercises: [{ id: crypto.randomUUID(), exercise_id: existingId, sets: [{ weight_kg: 70, reps: 5, pr_kinds: [] }] }],
      },
    }),
  );

  const plan = planImport({
    templates: templatesFixture.exercise_templates as HevyTemplate[],
    workouts: workoutsFixture.workouts as HevyWorkout[],
    pt: ptFixture as PtCatalog,
    existing: [
      { name: "Supino Reto (Barra)", muscle_group: "Peito" },
      { name: "Remada unilateral", muscle_group: "Costas" },
    ],
    overrides: { "Remada unilateral": "F1E57334" },
  });
  dir = mkdtempSync(join(tmpdir(), "bctrl-hevy-"));
  sqlFile = join(dir, "import.private.sql");
  writeFileSync(sqlFile, buildImportSql({ ownerEmail: owner.email, plan }));
}, 60_000);

afterAll(async () => {
  await deleteTestUser(owner);
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("importação do Hevy no Supabase local", () => {
  it("aplica duas vezes sem duplicar nada", async () => {
    applySql(sqlFile);
    const first = await counts(owner.id);
    // 9 modelos, 2 deles vinculados aos exercícios existentes: 2 + 7 = 9 linhas.
    expect(first).toEqual({ exercises: 9, workouts: 4, hevyWorkouts: 3, workoutExercises: 10, sets: 15 });

    applySql(sqlFile);
    expect(await counts(owner.id)).toEqual(first);
  }, 120_000);

  it("vínculo reaproveita o id existente e mantém o nome e o treino da v1", async () => {
    const db = adminClient();
    const { data: linked } = await db
      .from("exercises")
      .select("id, name, hevy_template_id, exercise_type, equipment, source, media_url, secondary_muscles")
      .eq("user_id", owner.id)
      .in("hevy_template_id", ["79D0BB3A", "F1E57334"])
      .order("hevy_template_id");
    expect(linked).toEqual([
      {
        id: existingId,
        name: "Supino Reto (Barra)",
        hevy_template_id: "79D0BB3A",
        exercise_type: "weight_reps",
        equipment: "Barra",
        source: "hevy",
        media_url: "https://cdn.example.test/exercise-assets/bench-press-barbell.mp4",
        secondary_muscles: ["Tríceps", "Ombros"],
      },
      expect.objectContaining({ id: otherId, name: "Remada unilateral", hevy_template_id: "F1E57334" }),
    ]);

    // Treino da v1 continua no mesmo exercício; os do Hevy também apontam para ele.
    const { data: uses } = await db
      .from("workout_exercises")
      .select("workout_id, workouts!inner(source)")
      .eq("user_id", owner.id)
      .eq("exercise_id", existingId);
    const sources = (uses ?? []).map((u) => (u.workouts as unknown as { source: string }).source).sort();
    expect(sources).toEqual(["bctrl", "hevy", "hevy"]);

    const { data: custom } = await db
      .from("exercises")
      .select("name, source, exercise_type")
      .eq("user_id", owner.id)
      .eq("source", "hevy_custom");
    expect(custom).toEqual([{ name: "Exercício Personalizado D'Teste", source: "hevy_custom", exercise_type: "reps_only" }]);
  });

  it("datas em America/Sao_Paulo, aquecimento sem PR e recordes do histórico", async () => {
    const db = adminClient();
    const { data: workouts } = await db
      .from("workouts")
      .select("day, started_at, finished_at, notes, hevy_workout_id")
      .eq("user_id", owner.id)
      .eq("source", "hevy")
      .order("started_at");
    expect(workouts?.map((w) => w.day)).toEqual(["2026-03-01", "2026-03-03", "2026-03-05"]);
    expect(workouts?.[0]).toMatchObject({ notes: "Treino A\n\nDescrição fictícia", hevy_workout_id: "a1111111-1111-4111-8111-111111111111" });

    const { data: sets } = await db
      .from("workout_sets")
      .select("set_type, weight_kg, reps, distance_m, duration_s, pr_kinds, workout_exercises!inner(exercise_id, workouts!inner(day, source))")
      .eq("user_id", owner.id)
      .eq("workout_exercises.workouts.source", "hevy");
    const warmups = (sets ?? []).filter((s) => s.set_type === "warmup");
    expect(warmups).toHaveLength(2);
    expect(warmups.every((s) => s.pr_kinds.length === 0)).toBe(true);
    const prs = (sets ?? []).filter((s) => s.pr_kinds.length > 0).map((s) => s.pr_kinds[0]).sort();
    expect(prs).toEqual(["distance", "duration", "weight"]);
    expect(sets?.find((s) => s.distance_m !== null)).toBeTruthy();

    // A view de recordes enxerga o histórico importado (sem o aquecimento de 80 kg).
    const { data: bests } = await db
      .from("v_exercise_bests")
      .select("max_weight")
      .eq("user_id", owner.id)
      .eq("exercise_id", existingId)
      .single();
    expect(Number(bests?.max_weight)).toBe(70);
  });

  it("vínculo decidido depois da primeira aplicação migra o histórico sem duplicar", async () => {
    const plankId = crypto.randomUUID();
    const { error } = await owner.client.from("exercises").insert({ id: plankId, name: "Minha prancha", muscle_group: "Abdômen" });
    expect(error).toBeNull();
    const before = await counts(owner.id);

    const plan = planImport({
      templates: templatesFixture.exercise_templates as HevyTemplate[],
      workouts: workoutsFixture.workouts as HevyWorkout[],
      pt: ptFixture as PtCatalog,
      existing: [
        { name: "Supino Reto (Barra)", muscle_group: "Peito" },
        { name: "Remada unilateral", muscle_group: "Costas" },
        { name: "Minha prancha", muscle_group: "Abdômen" },
      ],
      overrides: { "Remada unilateral": "F1E57334", "Minha prancha": "C6C9B8A0" },
    });
    const file = join(dir, "import-2.private.sql");
    writeFileSync(file, buildImportSql({ ownerEmail: owner.email, plan }));
    applySql(file);
    applySql(file);

    // A "Prancha" criada pela primeira importação some; o histórico passa para "Minha prancha".
    expect(await counts(owner.id)).toEqual({ ...before, exercises: before.exercises! - 1 });
    const db = adminClient();
    const { data: plank } = await db.from("exercises").select("id, name").eq("user_id", owner.id).eq("hevy_template_id", "C6C9B8A0");
    expect(plank).toEqual([{ id: plankId, name: "Minha prancha" }]);
    const { count } = await db
      .from("workout_exercises")
      .select("id", { count: "exact", head: true })
      .eq("user_id", owner.id)
      .eq("exercise_id", plankId);
    expect(count).toBe(2);
  }, 120_000);
});
