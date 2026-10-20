/**
 * Pontuação "dia no controle" (0–4) e nível do heatmap do Perfil. Sem I/O.
 *
 * Os critérios são calculados no banco (`daily_scores`, em America/Sao_Paulo), 1 ponto cada:
 * - treino finalizado ou cardio registrado;
 * - dieta: adesão do dia ≥ 80% (regra do `week_summary`: o pós-treino só conta em dia de treino);
 * - hábitos: todos os hábitos diários ativos naquele dia cumpridos. Sem nenhum hábito diário
 *   ativo, o critério não conta (o ponto é por cumprir hábitos, não pela falta deles);
 * - tarefas: pelo menos 1 tarefa concluída no dia.
 * O nível do heatmap é a própria pontuação. Dia no controle = pontuação ≥ 3.
 */

import { addDays } from "./stats";

export type Criteria = { trained: boolean; diet: boolean; habits: boolean; tasks: boolean };
export type CriterionKey = keyof Criteria;
export type ScoreValue = 0 | 1 | 2 | 3 | 4;

export type DayScore = Criteria & { day: string; score: ScoreValue };

/** Pontuação + os fatos do dia que as conquistas usam (mesma linha do `daily_scores`). */
export type DayFacts = DayScore & {
  /** Treinos finalizados no dia. */
  workouts: number;
  /** Volume do dia (kg), sem aquecimento. */
  volumeKg: number;
  /** Volume da melhor sessão do dia (kg), sem aquecimento. */
  bestSessionKg: number;
  /** Recordes batidos no dia (cada tipo de recorde de uma série conta 1). */
  prs: number;
  mealsPlanned: number;
  mealsDone: number;
};

/** Critérios na ordem de exibição, com rótulo em texto (o estado nunca é só cor). */
export const CRITERIA: readonly { key: CriterionKey; label: string }[] = [
  { key: "trained", label: "Treino ou cardio" },
  { key: "diet", label: "Dieta no plano (≥ 80%)" },
  { key: "habits", label: "Hábitos diários" },
  { key: "tasks", label: "Tarefa concluída" },
];

/** Pontuação mínima de um "dia no controle". */
export const CONTROL_MIN_SCORE = 3;

/** Máximo de dias por chamada ao `daily_scores`. */
export const MAX_SCORE_DAYS = 400;

export function scoreOf(c: Criteria): ScoreValue {
  return (Number(c.trained) + Number(c.diet) + Number(c.habits) + Number(c.tasks)) as ScoreValue;
}

/** Nível do heatmap (0–4) = pontuação, limitada à faixa. */
export function heatmapLevel(score: number): ScoreValue {
  if (!Number.isFinite(score) || score <= 0) return 0;
  return Math.min(4, Math.floor(score)) as ScoreValue;
}

export const isControlDay = (d: { score: number }) => d.score >= CONTROL_MIN_SCORE;

/** Rótulos dos critérios cumpridos (tooltip e tabela alternativa do heatmap). */
export function metCriteria(c: Criteria): string[] {
  return CRITERIA.filter((x) => c[x.key]).map((x) => x.label);
}

/** Linha do `daily_scores` como chega da API (`numeric` pode vir como texto). */
export type DailyScoreRow = {
  day: string;
  trained: boolean;
  diet: boolean;
  habits: boolean;
  tasks: boolean;
  score: number;
  workouts: number;
  volume_kg: number | string;
  best_session_kg: number | string;
  prs: number;
  meals_planned: number;
  meals_done: number;
};

export function toDayFacts(row: DailyScoreRow): DayFacts {
  const criteria: Criteria = { trained: row.trained, diet: row.diet, habits: row.habits, tasks: row.tasks };
  return {
    day: row.day,
    ...criteria,
    score: scoreOf(criteria),
    workouts: Number(row.workouts),
    volumeKg: Number(row.volume_kg),
    bestSessionKg: Number(row.best_session_kg),
    prs: Number(row.prs),
    mealsPlanned: Number(row.meals_planned),
    mealsDone: Number(row.meals_done),
  };
}

/** Divide `from`–`to` em intervalos contíguos de até `max` dias (o limite do `daily_scores`). */
export function scoreChunks(from: string, to: string, max = MAX_SCORE_DAYS): [string, string][] {
  const chunks: [string, string][] = [];
  for (let start = from; start <= to; start = addDays(start, max)) {
    const end = addDays(start, max - 1);
    chunks.push([start, end < to ? end : to]);
  }
  return chunks;
}
