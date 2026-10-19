import { dayInSaoPaulo } from "./day";

/**
 * Regras puras do plano alimentar (sem I/O).
 *
 * Pós-treino: refeições `training_day_only` só existem no dia em que há treino, ou seja,
 * uma sessão iniciada no aparelho nesse dia (São Paulo) ou um treino finalizado com
 * `workouts.day` igual ao dia. Fora disso, não aparecem e não contam na adesão.
 *
 * Adesão: uma refeição prevista está **no plano** quando tem registro com `off_plan = false`.
 * "Fora do plano" conta como **registrada** (a refeição não ficou esquecida), mas **não** como
 * aderente: entra em `logged` e `offPlan`, nunca em `done`. Assim o percentual mede o plano
 * seguido, do mesmo jeito que o `week_summary` do banco (que só soma `not off_plan`).
 */

export type PlanMeal = {
  id: string;
  name: string;
  /** "HH:MM" ou "HH:MM:SS"; `null` = sem horário fixo (ex.: pós-treino). */
  time: string | null;
  position: number;
  training_day_only: boolean;
};

export type MealLogEntry = { meal_id: string; option_id: string | null; off_plan: boolean };

export type MealStatus = "pending" | "done" | "off_plan";

export type Adherence = {
  /** Refeições previstas no dia (as visíveis). */
  planned: number;
  /** Feitas dentro do plano. */
  done: number;
  /** Registradas como fora do plano. */
  offPlan: number;
  /** done + offPlan. */
  logged: number;
  /** done / planned, de 0 a 100 (inteiro). 0 quando não há nada previsto. */
  pct: number;
};

/**
 * Ordem do dia: as refeições com horário em ordem de horário; as sem horário ficam no
 * lugar da sua `position` (o pós-treino, na posição 5, fica entre o lanche e o jantar).
 */
export function orderMeals<T extends PlanMeal>(meals: readonly T[]): T[] {
  const byPosition = [...meals].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const timed = byPosition
    .filter((m) => m.time !== null)
    .sort((a, b) => a.time!.localeCompare(b.time!) || a.position - b.position);
  let next = 0;
  return byPosition.map((m) => (m.time === null ? m : timed[next++]));
}

/** Refeições do dia, já ordenadas. Sem treino, as de "só dia de treino" saem. */
export function visibleMeals<T extends PlanMeal>(meals: readonly T[], hasWorkout: boolean): T[] {
  return orderMeals(hasWorkout ? meals : meals.filter((m) => !m.training_day_only));
}

/** Estado de uma refeição a partir do registro do dia (ou da falta dele). */
export function mealStatus(log: MealLogEntry | null | undefined): MealStatus {
  if (!log) return "pending";
  return log.off_plan ? "off_plan" : "done";
}

/** Adesão do dia. Registros de refeições fora de `visible` (ex.: pós-treino sem treino) são ignorados. */
export function adherence(logs: readonly MealLogEntry[], visible: readonly Pick<PlanMeal, "id">[]): Adherence {
  const ids = new Set(visible.map((m) => m.id));
  const counted = new Set<string>();
  let done = 0;
  let offPlan = 0;
  for (const log of logs) {
    // Um registro por refeição (o banco garante; aqui só por segurança).
    if (!ids.has(log.meal_id) || counted.has(log.meal_id)) continue;
    counted.add(log.meal_id);
    if (log.off_plan) offPlan += 1;
    else done += 1;
  }
  const planned = ids.size;
  return { planned, done, offPlan, logged: done + offPlan, pct: planned === 0 ? 0 : Math.round((done * 100) / planned) };
}

/**
 * Há treino no dia? Sessão ativa no aparelho iniciada nesse dia (São Paulo) ou treino
 * finalizado gravado com esse `day`.
 */
export function hasWorkoutOn(
  day: string,
  { activeStartedAt, finishedDays }: { activeStartedAt: string | null | undefined; finishedDays: readonly string[] },
): boolean {
  if (activeStartedAt && dayInSaoPaulo(activeStartedAt) === day) return true;
  return finishedDays.includes(day);
}

/** "08:30:00" → "08:30". */
export function formatMealTime(time: string | null): string | null {
  return time === null ? null : time.slice(0, 5);
}
