import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deleteMeasurement,
  fetchCompositionGoals,
  fetchMeasurements,
  updateCompositionGoal,
  upsertCompositionGoal,
  upsertMeasurement,
  type MeasurementSave,
} from "@/features/composition/api";
import { fetchBodyWeights, upsertBodyWeight } from "@/features/progress/api";
import type { Database } from "@/lib/database.types";
import { anonClient, createTestUser, deleteTestUser, type TestUser } from "../support/test-users";

/**
 * Task 1.0 v3: `body_measurements` (checks, RLS), o trigger `sync_body_weight` (peso do dia em
 * `body_weights`), `composition_goals` (uma meta ativa por métrica) e as colunas novas de
 * `profiles` e `body_weights`. Dados fictícios, usuários descartáveis no Supabase LOCAL.
 */

async function must<T>(op: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  const { data, error } = await op;
  if (error) throw new Error(JSON.stringify(error));
  return data;
}

/** Medição fictícia: `hora` no fuso de São Paulo (−03:00), dia coerente com o instante. */
function measurement(day: string, time: string, weight_kg: number, extra: Record<string, unknown> = {}) {
  return { id: crypto.randomUUID(), measured_at: `${day}T${time}:00-03:00`, day, weight_kg, ...extra };
}

let owner: TestUser;
let other: TestUser;
let db: SupabaseClient<Database>;

beforeAll(async () => {
  owner = await createTestUser("composicao");
  other = await createTestUser("composicao-outro");
  db = owner.client as SupabaseClient<Database>;
});
afterAll(async () => {
  await deleteTestUser(owner);
  await deleteTestUser(other);
});

/** Linha de `body_weights` do dia (ou `null`), lida pelo próprio dono. */
async function weightOf(client: SupabaseClient, day: string) {
  const row = await must(client.from("body_weights").select("weight_kg, source").eq("day", day).maybeSingle());
  return row ? { weight_kg: Number(row.weight_kg), source: row.source } : null;
}

const insert = (client: SupabaseClient, row: Record<string, unknown>) => client.from("body_measurements").insert(row);

describe("body_measurements: colunas e checks", () => {
  it("só o peso é obrigatório; as outras métricas ficam nulas e a origem padrão é manual", async () => {
    const m = measurement("2026-06-01", "07:00", 84.3);
    await must(insert(owner.client, m));
    const row = await must(owner.client.from("body_measurements").select("*").eq("id", m.id).single());
    expect(row).toMatchObject({ user_id: owner.id, day: "2026-06-01", source: "manual", body_fat_pct: null, metabolic_age: null });
    expect(Number(row.weight_kg)).toBe(84.3);
  });

  it("aceita as 17 métricas dentro da faixa", async () => {
    const m = measurement("2026-06-02", "07:00", 84, {
      bmi: 25.9,
      body_fat_pct: 22.4,
      fat_mass_kg: 18.8,
      skeletal_muscle_pct: 48.1,
      skeletal_muscle_kg: 36.2,
      muscle_rate_pct: 73.4,
      muscle_mass_kg: 61.6,
      visceral_fat: 9,
      water_pct: 55.2,
      water_kg: 46.4,
      bmr_kcal: 1786,
      obesity_pct: 17.7,
      bone_kg: 3.3,
      protein_pct: 18.2,
      lean_mass_kg: 65.2,
      metabolic_age: 34,
      source: "import",
      note: "fictícia",
    });
    await must(insert(owner.client, m));
  });

  it("peso ausente é recusado", async () => {
    const { error } = await insert(owner.client, { ...measurement("2026-06-03", "07:00", 80), weight_kg: null });
    expect(error?.code).toBe("23502");
  });

  it.each([
    ["weight_kg", 10],
    ["body_fat_pct", 80],
    ["body_fat_pct", 1],
    ["visceral_fat", 0],
    ["visceral_fat", 61],
    ["bmr_kcal", 100],
    ["metabolic_age", 5],
  ])("%s = %s fora da faixa é recusado", async (column, value) => {
    const { error } = await insert(owner.client, measurement("2026-06-03", "07:00", 80, { [column]: value }));
    expect(error?.code).toBe("23514");
  });

  it("origem inválida e dia incoerente com o instante (São Paulo) são recusados", async () => {
    const source = await insert(owner.client, measurement("2026-06-03", "07:00", 80, { source: "app" }));
    expect(source.error?.code).toBe("23514");
    // 23:30 em São Paulo já é o dia seguinte em UTC, mas o dia é o de São Paulo.
    const ok = measurement("2026-06-04", "23:30", 80);
    await must(insert(owner.client, ok));
    const wrongDay = await insert(owner.client, { ...measurement("2026-06-04", "22:00", 80), day: "2026-06-05" });
    expect(wrongDay.error?.code).toBe("23514");
  });

  it("dois registros com o mesmo instante são recusados (user_id, measured_at)", async () => {
    await must(insert(owner.client, measurement("2026-06-06", "07:00", 80)));
    const { error } = await insert(owner.client, measurement("2026-06-06", "07:00", 81));
    expect(error?.code).toBe("23505");
  });
});

describe("body_measurements: RLS de dono", () => {
  const mine = measurement("2026-06-10", "07:00", 83);

  beforeAll(async () => {
    await must(insert(owner.client, mine));
  });

  it("outro usuário não lê, não altera, não apaga e não grava em nome do dono", async () => {
    expect(await must(other.client.from("body_measurements").select("id").eq("id", mine.id))).toEqual([]);
    expect(await must(other.client.from("body_measurements").update({ weight_kg: 99 }).eq("id", mine.id).select("id"))).toEqual([]);
    expect(await must(other.client.from("body_measurements").delete().eq("id", mine.id).select("id"))).toEqual([]);
    const forged = await insert(other.client, { ...measurement("2026-06-11", "07:00", 80), user_id: owner.id });
    expect(forged.error?.code).toBe("42501");
    expect(await weightOf(owner.client, "2026-06-11")).toBeNull();
    expect(await weightOf(owner.client, "2026-06-10")).toEqual({ weight_kg: 83, source: "scale" });
  });

  it("o peso que o trigger grava é só do dono (o outro não vê nem recebe linha)", async () => {
    expect(await weightOf(other.client, "2026-06-10")).toBeNull();
    const { count } = await other.client.from("body_weights").select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("anônimo não lê", async () => {
    const { data } = await anonClient().from("body_measurements").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("trigger sync_body_weight", () => {
  it("insert grava o peso do dia com source = 'scale'", async () => {
    await must(insert(owner.client, measurement("2026-07-01", "07:10", 82.35)));
    expect(await weightOf(owner.client, "2026-07-01")).toEqual({ weight_kg: 82.35, source: "scale" });
  });

  it("duas medições no dia: vale a de maior measured_at, não a última gravada", async () => {
    const night = measurement("2026-07-02", "21:00", 83.1);
    const morning = measurement("2026-07-02", "07:00", 82.2);
    await must(insert(owner.client, night));
    await must(insert(owner.client, morning));
    expect(await weightOf(owner.client, "2026-07-02")).toEqual({ weight_kg: 83.1, source: "scale" });
    const { count } = await owner.client.from("body_weights").select("id", { count: "exact", head: true }).eq("day", "2026-07-02");
    expect(count).toBe(1);
  });

  it("update do peso, do instante e do dia recalculam os dias afetados", async () => {
    const a = measurement("2026-07-03", "07:00", 81.5);
    const b = measurement("2026-07-03", "20:00", 82.5);
    await must(insert(owner.client, a));
    await must(insert(owner.client, b));
    expect(await weightOf(owner.client, "2026-07-03")).toEqual({ weight_kg: 82.5, source: "scale" });

    await must(owner.client.from("body_measurements").update({ weight_kg: 82.9 }).eq("id", b.id));
    expect(await weightOf(owner.client, "2026-07-03")).toEqual({ weight_kg: 82.9, source: "scale" });

    // `a` passa a ser a mais recente do dia.
    await must(owner.client.from("body_measurements").update({ measured_at: "2026-07-03T22:00:00-03:00" }).eq("id", a.id));
    expect(await weightOf(owner.client, "2026-07-03")).toEqual({ weight_kg: 81.5, source: "scale" });

    // `a` muda de dia: o dia antigo volta para `b`, o novo ganha `a`.
    await must(
      owner.client.from("body_measurements").update({ measured_at: "2026-07-04T07:00:00-03:00", day: "2026-07-04" }).eq("id", a.id),
    );
    expect(await weightOf(owner.client, "2026-07-03")).toEqual({ weight_kg: 82.9, source: "scale" });
    expect(await weightOf(owner.client, "2026-07-04")).toEqual({ weight_kg: 81.5, source: "scale" });
  });

  it("delete da mais recente volta para a anterior; delete da última remove o peso 'scale'", async () => {
    const first = measurement("2026-07-05", "07:00", 80.8);
    const last = measurement("2026-07-05", "19:00", 81.6);
    await must(insert(owner.client, first));
    await must(insert(owner.client, last));
    expect(await weightOf(owner.client, "2026-07-05")).toEqual({ weight_kg: 81.6, source: "scale" });

    await must(owner.client.from("body_measurements").delete().eq("id", last.id));
    expect(await weightOf(owner.client, "2026-07-05")).toEqual({ weight_kg: 80.8, source: "scale" });

    await must(owner.client.from("body_measurements").delete().eq("id", first.id));
    expect(await weightOf(owner.client, "2026-07-05")).toBeNull();
  });

  it("peso manual gravado depois da medição sobrescreve como 'manual' (a última gravação vence)", async () => {
    await must(insert(owner.client, measurement("2026-07-06", "07:00", 82)));
    await upsertBodyWeight({ day: "2026-07-06", weight_kg: 81.4 }, db);
    expect(await weightOf(owner.client, "2026-07-06")).toEqual({ weight_kg: 81.4, source: "manual" });
  });

  it("apagar a medição não apaga o peso manual do dia", async () => {
    const m = measurement("2026-07-07", "07:00", 82);
    await must(insert(owner.client, m));
    await upsertBodyWeight({ day: "2026-07-07", weight_kg: 81.7 }, db);
    await must(owner.client.from("body_measurements").delete().eq("id", m.id));
    expect(await weightOf(owner.client, "2026-07-07")).toEqual({ weight_kg: 81.7, source: "manual" });
  });

  it("medição gravada depois do peso manual sobrescreve como 'scale'", async () => {
    await upsertBodyWeight({ day: "2026-07-08", weight_kg: 83 }, db);
    expect(await weightOf(owner.client, "2026-07-08")).toEqual({ weight_kg: 83, source: "manual" });
    await must(insert(owner.client, measurement("2026-07-08", "07:00", 82.6)));
    expect(await weightOf(owner.client, "2026-07-08")).toEqual({ weight_kg: 82.6, source: "scale" });
  });

  it("editar só a nota ou uma métrica que não é o peso não mexe no peso manual do dia", async () => {
    const m = measurement("2026-07-09", "07:00", 82);
    await must(insert(owner.client, m));
    await upsertBodyWeight({ day: "2026-07-09", weight_kg: 81.2 }, db);
    await must(owner.client.from("body_measurements").update({ note: "depois do treino", body_fat_pct: 21 }).eq("id", m.id));
    expect(await weightOf(owner.client, "2026-07-09")).toEqual({ weight_kg: 81.2, source: "manual" });
  });

  it("peso manual sem medição nasce 'manual'; source inválido é recusado", async () => {
    await upsertBodyWeight({ day: "2026-07-10", weight_kg: 82.1 }, db);
    expect(await weightOf(owner.client, "2026-07-10")).toEqual({ weight_kg: 82.1, source: "manual" });
    const { error } = await owner.client.from("body_weights").update({ source: "app" }).eq("day", "2026-07-10");
    expect(error?.code).toBe("23514");
  });

  it("insert em lote (como a importação) deixa um peso por dia, o da mais recente", async () => {
    await must(
      owner.client.from("body_measurements").insert([
        measurement("2026-07-11", "07:00", 81, { source: "import" }),
        measurement("2026-07-11", "22:00", 81.9, { source: "import" }),
        measurement("2026-07-12", "07:00", 80.7, { source: "import" }),
      ]),
    );
    expect(await weightOf(owner.client, "2026-07-11")).toEqual({ weight_kg: 81.9, source: "scale" });
    expect(await weightOf(owner.client, "2026-07-12")).toEqual({ weight_kg: 80.7, source: "scale" });
  });

  it("excluir o usuário com várias medições no mesmo dia apaga tudo por cascata", async () => {
    const temp = await createTestUser("composicao-cascata");
    await must(temp.client.from("body_measurements").insert([measurement("2026-07-13", "07:00", 80), measurement("2026-07-13", "21:00", 81)]));
    await expect(deleteTestUser(temp)).resolves.toBeUndefined();
  });
});

describe("composition_goals", () => {
  const goal = (metric: string, target: number) => ({
    id: crypto.randomUUID(),
    metric,
    target,
    start_value: 22,
    start_day: "2026-07-01",
  });

  it("uma meta ativa por métrica; arquivar libera uma nova", async () => {
    const fat = goal("body_fat_pct", 15);
    await must(owner.client.from("composition_goals").insert(fat));
    const dup = await owner.client.from("composition_goals").insert(goal("body_fat_pct", 14));
    expect(dup.error?.code).toBe("23505");

    // Outra métrica pode ter a própria meta ativa.
    await must(owner.client.from("composition_goals").insert(goal("visceral_fat", 7)));

    await must(owner.client.from("composition_goals").update({ archived_at: new Date().toISOString() }).eq("id", fat.id));
    await must(owner.client.from("composition_goals").insert(goal("body_fat_pct", 14)));
  });

  it("a meta ativa de um usuário não bloqueia a do outro", async () => {
    await must(other.client.from("composition_goals").insert(goal("body_fat_pct", 18)));
  });

  it("métrica fora das 4 com meta é recusada", async () => {
    const { error } = await owner.client.from("composition_goals").insert(goal("water_pct", 60));
    expect(error?.code).toBe("23514");
  });

  it("RLS: outro usuário não lê, não altera, não apaga e não grava em nome do dono", async () => {
    const mine = goal("weight_kg", 78);
    await must(owner.client.from("composition_goals").insert(mine));
    expect(await must(other.client.from("composition_goals").select("id").eq("id", mine.id))).toEqual([]);
    expect(await must(other.client.from("composition_goals").update({ target: 1 }).eq("id", mine.id).select("id"))).toEqual([]);
    expect(await must(other.client.from("composition_goals").delete().eq("id", mine.id).select("id"))).toEqual([]);
    const forged = await other.client.from("composition_goals").insert({ ...goal("skeletal_muscle_kg", 40), user_id: owner.id });
    expect(forged.error?.code).toBe("42501");
    expect((await anonClient().from("composition_goals").select("id")).data ?? []).toEqual([]);
  });
});

describe("profiles: fonte da TMB e base da proteína", () => {
  it("padrões auto, weight e 2,5 g/kg de massa magra; valores inválidos recusados", async () => {
    await must(owner.client.from("profiles").insert({ display_name: "Teste" }));
    const row = await must(owner.client.from("profiles").select("bmr_source, protein_basis, protein_g_per_kg_lean").single());
    expect(row).toEqual({ bmr_source: "auto", protein_basis: "weight", protein_g_per_kg_lean: 2.5 });

    const bmr = await owner.client.from("profiles").update({ bmr_source: "app" }).eq("user_id", owner.id);
    expect(bmr.error?.code).toBe("23514");
    const basis = await owner.client.from("profiles").update({ protein_basis: "fat" }).eq("user_id", owner.id);
    expect(basis.error?.code).toBe("23514");
    const lean = await owner.client.from("profiles").update({ protein_g_per_kg_lean: 9 }).eq("user_id", owner.id);
    expect(lean.error?.code).toBe("23514");
    await must(owner.client.from("profiles").update({ bmr_source: "scale", protein_basis: "lean_mass", protein_g_per_kg_lean: 2.2 }).eq("user_id", owner.id));
  });
});

describe("composição via API (gravações do WRITES)", () => {
  let user: TestUser;
  let api: SupabaseClient<Database>;

  beforeAll(async () => {
    user = await createTestUser("composicao-api");
    api = user.client as SupabaseClient<Database>;
  });
  afterAll(async () => {
    await deleteTestUser(user);
  });

  const save: MeasurementSave = {
    id: crypto.randomUUID(),
    measured_at: "2026-08-01T07:00:00-03:00",
    day: "2026-08-01",
    source: "manual",
    note: null,
    weight_kg: 82.4,
    bmi: null,
    body_fat_pct: 21.5,
    fat_mass_kg: null,
    skeletal_muscle_pct: null,
    skeletal_muscle_kg: 36.4,
    muscle_rate_pct: null,
    muscle_mass_kg: null,
    visceral_fat: 9,
    water_pct: null,
    water_kg: null,
    bmr_kcal: null,
    obesity_pct: null,
    bone_kg: null,
    protein_pct: null,
    lean_mass_kg: 64.7,
    metabolic_age: null,
  };

  it("salvar 2 vezes (reenvio) não duplica; editar pelo mesmo id atualiza e limpa métricas", async () => {
    await upsertMeasurement(save, api);
    await upsertMeasurement(save, api);
    await upsertMeasurement({ ...save, weight_kg: 82.1, visceral_fat: null }, api);
    const list = await fetchMeasurements(api);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: save.id, day: "2026-08-01", weight_kg: 82.1, visceral_fat: null, body_fat_pct: 21.5 });
    expect(await weightOf(user.client, "2026-08-01")).toEqual({ weight_kg: 82.1, source: "scale" });
  });

  it("fetchBodyWeights devolve a origem do peso do dia (balança ou manual)", async () => {
    await upsertBodyWeight({ day: "2026-07-31", weight_kg: 82.9 }, api);
    expect(await fetchBodyWeights(api)).toEqual([
      { day: "2026-07-31", weight_kg: 82.9, source: "manual" },
      { day: "2026-08-01", weight_kg: 82.1, source: "scale" },
    ]);
  });

  it("excluir a medição remove o peso do dia que veio dela", async () => {
    await deleteMeasurement(save.id, api);
    expect(await fetchMeasurements(api)).toEqual([]);
    expect(await weightOf(user.client, "2026-08-01")).toBeNull();
  });

  it("metas: criar, ler e arquivar", async () => {
    const id = crypto.randomUUID();
    await upsertCompositionGoal({ id, metric: "body_fat_pct", target: 15, target_date: null, start_value: 21.5, start_day: "2026-08-01" }, api);
    await upsertCompositionGoal({ id, metric: "body_fat_pct", target: 15, target_date: null, start_value: 21.5, start_day: "2026-08-01" }, api);
    expect(await fetchCompositionGoals(api)).toEqual([
      { id, metric: "body_fat_pct", target: 15, target_date: null, start_value: 21.5, start_day: "2026-08-01", achieved_on: null, archived_at: null },
    ]);
    await updateCompositionGoal(id, { archived_at: "2026-09-01T12:00:00Z" }, api);
    expect(await fetchCompositionGoals(api)).toEqual([]);
  });
});
