/**
 * Conquistas do Perfil, derivadas do histórico (sem tabela): sempre coerentes com os dados,
 * inclusive depois de editar ou importar treinos. Sem I/O.
 *
 * Entrada: os fatos de cada dia (`daily_scores` → `DayFacts`) do histórico inteiro, o que inclui
 * os treinos importados do Hevy (são treinos finalizados como os outros) e os `pr_kinds` gravados
 * na importação. Cada conquista diz a regra em texto, a data de desbloqueio e o progresso.
 */

import { isControlDay, type DayFacts } from "@/lib/domain/score";
import { addWeeks, monthEnd, monthStart, weekStart } from "@/lib/domain/week";

export type AchievementCtx = {
  /** Dias do histórico (qualquer ordem; dias sem nada podem faltar). */
  days: readonly DayFacts[];
  /** Hoje (AAAA-MM-DD, São Paulo). */
  today: string;
  /** Medições em ordem livre; só % de gordura é necessária para a conquista. */
  measurements?: readonly { day: string; measuredAt: string; bodyFatPct: number | null }[];
  /** Metas ativas ou arquivadas; qualquer conclusão histórica mantém a conquista. */
  goals?: readonly { achievedOn: string | null }[];
};

export type AchievementStatus = {
  /** Dia em que foi desbloqueada, ou `null` se ainda está bloqueada. */
  unlockedOn: string | null;
  /** 0–1, para a barra. 1 quando desbloqueada. */
  progress: number;
  /** Onde está hoje, na unidade da meta (ex.: 82 de 100 treinos). */
  current: number;
  target: number;
};

export type Achievement = {
  key: string;
  title: string;
  rule: string;
  evaluate(ctx: AchievementCtx): AchievementStatus;
};

/** Meta semanal de treino (a mesma do `week_summary`). */
export const WEEKLY_WORKOUT_TARGET = 4;

const sorted = (days: readonly DayFacts[]) => [...days].sort((a, b) => a.day.localeCompare(b.day));

function status(unlockedOn: string | null, current: number, target: number): AchievementStatus {
  return {
    unlockedOn,
    progress: unlockedOn ? 1 : Math.max(0, Math.min(1, current / target)),
    current,
    target,
  };
}

/** Desbloqueia no dia em que a soma de `value` chega à meta; senão, progresso pela soma. */
function cumulative(ctx: AchievementCtx, target: number, value: (d: DayFacts) => number): AchievementStatus {
  let total = 0;
  for (const d of sorted(ctx.days)) {
    total += value(d);
    if (total >= target) return status(d.day, target, target);
  }
  return status(null, total, target);
}

/** Sequência de semanas com a meta de treino (dias distintos com treino finalizado ≥ 4). */
function trainingWeeks(ctx: AchievementCtx): AchievementStatus {
  const target = 4;
  const trainingDays = sorted(ctx.days).filter((d) => d.workouts > 0 && d.day <= ctx.today);
  const byWeek = new Map<string, string[]>();
  for (const d of trainingDays) {
    const w = weekStart(d.day);
    byWeek.set(w, [...(byWeek.get(w) ?? []), d.day]);
  }
  /** Dia em que a semana bateu a meta, ou `null`. */
  const metOn = (week: string) => byWeek.get(week)?.[WEEKLY_WORKOUT_TARGET - 1] ?? null;

  const current = weekStart(ctx.today);
  let run = 0;
  if (trainingDays.length > 0) {
    for (let w = weekStart(trainingDays[0].day); w <= current; w = addWeeks(w, 1)) {
      const met = metOn(w);
      if (met) {
        run += 1;
        if (run === target) return status(met, target, target);
      } else if (w !== current) {
        // A semana em curso que ainda não bateu a meta não quebra a sequência.
        run = 0;
      }
    }
  }
  return status(null, run, target);
}

/** Adesão de cada mês fechado (soma das refeições feitas ÷ previstas), em %. */
function dietMonth(ctx: AchievementCtx): AchievementStatus {
  const target = 80;
  const months = new Map<string, { planned: number; done: number }>();
  for (const d of ctx.days) {
    const m = monthStart(d.day);
    const acc = months.get(m) ?? { planned: 0, done: 0 };
    acc.planned += d.mealsPlanned;
    acc.done += d.mealsDone;
    months.set(m, acc);
  }
  let best = 0;
  for (const [m, { planned, done }] of [...months].sort(([a], [b]) => a.localeCompare(b))) {
    // Só mês inteiro: o mês em curso (e o futuro) ainda não fechou.
    if (monthEnd(m) >= ctx.today || planned === 0) continue;
    const pct = Math.round((done * 100) / planned);
    if (done * 100 >= planned * target) return status(monthEnd(m), pct, target);
    best = Math.max(best, pct);
  }
  return status(null, best, target);
}

/** Queda acumulada de 1 ponto percentual desde a primeira medição com % de gordura. */
function bodyFatDown(ctx: AchievementCtx): AchievementStatus {
  const target = 1;
  const measurements = [...(ctx.measurements ?? [])]
    .filter((m) => m.bodyFatPct !== null && m.day <= ctx.today)
    .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const first = measurements[0]?.bodyFatPct;
  if (first === null || first === undefined) return status(null, 0, target);

  let best = 0;
  for (const measurement of measurements) {
    const decrease = Math.round((first - measurement.bodyFatPct!) * 100) / 100;
    best = Math.max(best, decrease);
    if (decrease >= target) return status(measurement.day, target, target);
  }
  return status(null, best, target);
}

function compositionGoal(ctx: AchievementCtx): AchievementStatus {
  const achievedOn = (ctx.goals ?? [])
    .flatMap((goal) => goal.achievedOn && goal.achievedOn <= ctx.today ? [goal.achievedOn] : [])
    .sort()[0] ?? null;
  return status(achievedOn, achievedOn ? 1 : 0, 1);
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    key: "first_pr",
    title: "Primeiro recorde",
    rule: "Bata um recorde pessoal (carga, volume, 1RM, duração ou distância) em qualquer exercício.",
    evaluate: (ctx) => cumulative(ctx, 1, (d) => (d.prs > 0 ? 1 : 0)),
  },
  {
    key: "training_weeks_4",
    title: "Quatro semanas firmes",
    rule: `Treine em pelo menos ${WEEKLY_WORKOUT_TARGET} dias por semana, 4 semanas seguidas (domingo a sábado).`,
    evaluate: trainingWeeks,
  },
  {
    key: "control_days_30",
    title: "30 dias no controle",
    rule: "Some 30 dias com pontuação 3 ou 4 (não precisam ser seguidos).",
    evaluate: (ctx) => cumulative(ctx, 30, (d) => (isControlDay(d) ? 1 : 0)),
  },
  {
    key: "session_1000kg",
    title: "Uma tonelada",
    rule: "Levante 1.000 kg de volume numa única sessão (carga × repetições, sem aquecimento).",
    evaluate: (ctx) => {
      const days = sorted(ctx.days);
      const hit = days.find((d) => d.bestSessionKg >= 1000);
      const best = days.reduce((max, d) => Math.max(max, d.bestSessionKg), 0);
      return status(hit?.day ?? null, best, 1000);
    },
  },
  {
    key: "workouts_100",
    title: "100 treinos",
    rule: "Finalize 100 treinos, contando o histórico importado do Hevy.",
    evaluate: (ctx) => cumulative(ctx, 100, (d) => d.workouts),
  },
  {
    key: "diet_month_80",
    title: "Mês no plano",
    rule: "Feche um mês inteiro com adesão alimentar de 80% ou mais.",
    evaluate: dietMonth,
  },
  {
    key: "body_fat_down_1",
    title: "−1 ponto de gordura",
    rule: "Reduza 1 ponto percentual de gordura corporal desde a primeira medição.",
    evaluate: bodyFatDown,
  },
  {
    key: "composition_goal",
    title: "Meta de composição atingida",
    rule: "Atinja qualquer meta de peso, gordura, músculo ou gordura visceral.",
    evaluate: compositionGoal,
  },
];

export type AchievementView = Omit<Achievement, "evaluate"> & AchievementStatus;

/** Todas as conquistas avaliadas, na ordem do catálogo. */
export function evaluateAchievements(ctx: AchievementCtx): AchievementView[] {
  return ACHIEVEMENTS.map(({ evaluate, ...a }) => ({ ...a, ...evaluate(ctx) }));
}
