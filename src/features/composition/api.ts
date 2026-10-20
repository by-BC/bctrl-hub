import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { METRICS, type GoalMetric, type MetricKey } from "@/lib/domain/composition";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/**
 * Composição corporal (v3): medições da balança (`body_measurements`) e metas de composição
 * (`composition_goals`), ambas com RLS de dono. O peso do dia em `body_weights` é gravado pelo
 * trigger `sync_body_weight` a partir da medição; aqui não se mexe nele.
 * O cliente é parâmetro para os testes de integração usarem um usuário descartável.
 */

type Client = SupabaseClient<Database>;
const db = (): Client => createClient();

export const compositionKeys = {
  all: ["composition"] as const,
  measurements: () => ["composition", "measurements"] as const,
  goals: () => ["composition", "goals"] as const,
};

function fail(error: { message: string; code?: string }, message: string): never {
  console.error("[bctrl]", message, error);
  throw new DataError(message, error.code);
}

type Metrics = Record<MetricKey, number | null>;

export type MeasurementSource = "import" | "manual";

/**
 * Medição completa como o app grava: todas as 17 métricas (`null` = não medida), para que editar
 * pelo mesmo id limpe o que foi apagado. `day` é o dia de São Paulo de `measured_at` (o banco confere).
 */
export type MeasurementSave = Omit<Metrics, "weight_kg"> & {
  id: string;
  weight_kg: number;
  measured_at: string;
  day: string;
  source: MeasurementSource;
  note: string | null;
};

export type Measurement = MeasurementSave;

const METRIC_COLUMNS = METRICS.map((m) => m.key).join(", ");

/** Todas as medições, em ordem cronológica. */
export async function fetchMeasurements(client: Client = db()): Promise<Measurement[]> {
  const { data, error } = await client
    .from("body_measurements")
    .select(`id, measured_at, day, source, note, ${METRIC_COLUMNS}`)
    .order("measured_at");
  if (error) fail(error, "Não foi possível carregar as medições.");
  return (data as unknown as Record<string, unknown>[]).map((row) => {
    const metrics = Object.fromEntries(
      METRICS.map(({ key }) => [key, row[key] === null || row[key] === undefined ? null : Number(row[key])]),
    ) as Omit<Metrics, "weight_kg">;
    return {
      ...metrics,
      weight_kg: Number(row.weight_kg),
      id: String(row.id),
      measured_at: String(row.measured_at),
      day: String(row.day),
      source: row.source === "import" ? "import" : "manual",
      note: (row.note as string | null) ?? null,
    };
  });
}

/** Grava ou substitui a medição pelo id (gerado no cliente): reenviar é idempotente. */
export async function upsertMeasurement(row: MeasurementSave, client: Client = db()) {
  const { error } = await client.from("body_measurements").upsert(row, { onConflict: "id", defaultToNull: false });
  if (error) {
    if (error.code === "23505") fail(error, "Já existe uma medição nesse dia e horário.");
    if (error.code === "23514") fail(error, "Algum valor está fora da faixa aceita.");
    fail(error, "Não foi possível salvar a medição.");
  }
}

export async function deleteMeasurement(id: string, client: Client = db()) {
  const { error } = await client.from("body_measurements").delete().eq("id", id);
  if (error) fail(error, "Não foi possível excluir a medição.");
}

// ── Metas de composição ───────────────────────────────────────────────────

export type CompositionGoalSave = {
  id: string;
  metric: GoalMetric;
  target: number;
  target_date: string | null;
  start_value: number;
  start_day: string;
};

export type CompositionGoal = CompositionGoalSave & { achieved_on: string | null; archived_at: string | null };

export type CompositionGoalPatch = Partial<Pick<CompositionGoal, "target" | "target_date" | "achieved_on" | "archived_at">>;

/** Metas ativas (não arquivadas): no máximo uma por métrica. */
export async function fetchCompositionGoals(client: Client = db()): Promise<CompositionGoal[]> {
  const { data, error } = await client
    .from("composition_goals")
    .select("id, metric, target, target_date, start_value, start_day, achieved_on, archived_at")
    .is("archived_at", null)
    .order("created_at");
  if (error) fail(error, "Não foi possível carregar as metas de composição.");
  return data.map((g) => ({
    ...g,
    metric: g.metric as GoalMetric,
    target: Number(g.target),
    start_value: Number(g.start_value),
  }));
}

/** Cria ou substitui a meta pelo id. Já existir outra meta ativa para a métrica é recusado. */
export async function upsertCompositionGoal(row: CompositionGoalSave, client: Client = db()) {
  const { error } = await client.from("composition_goals").upsert(row, { onConflict: "id", defaultToNull: false });
  if (error) {
    if (error.code === "23505") fail(error, "Já existe uma meta ativa para essa métrica.");
    fail(error, "Não foi possível salvar a meta.");
  }
}

/** Altera a meta: alvo, data-alvo, conclusão ou arquivamento. */
export async function updateCompositionGoal(id: string, patch: CompositionGoalPatch, client: Client = db()) {
  const { error } = await client.from("composition_goals").update(patch).eq("id", id);
  if (error) fail(error, "Não foi possível atualizar a meta.");
}
