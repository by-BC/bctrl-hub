import type { HexSegmentKey } from "@/lib/domain/hex";
import { toPct, weekHex, type HabitPart } from "@/lib/domain/hex";
import { formatKg } from "@/lib/format";
import type { WeekSummary } from "@/features/week/api";

/**
 * Do `week_summary` ao que o Hex Week mostra: progresso de cada segmento, o número
 * principal e a linha de detalhe da legenda. Puro (sem React), usado pelo painel e
 * conferido no teste de integração contra o banco.
 */

export type HexWeekSegment = { progress: number; label: string; value: string; detail: string };
export type HexWeekView = Record<HexSegmentKey, HexWeekSegment> & {
  /** Semana sem nenhum registro (treino, refeição ou hábito). */
  empty: boolean;
};

const HABIT_NAMES: Record<HabitPart["key"], string> = {
  cardio: "Cardio",
  abs: "Abdominal",
  supplements: "Suplementos",
};

function habitDetail(part: HabitPart) {
  const unit = part.key === "cardio" ? " min" : "";
  return `${HABIT_NAMES[part.key]} ${formatKg(part.done)}/${formatKg(part.target)}${unit}`;
}

export function hexWeekView(summary: WeekSummary): HexWeekView {
  const hex = weekHex(summary);
  const { workouts, meals } = summary;
  const empty = workouts.done === 0 && meals.done === 0 && hex.habitParts.every((p) => p.done === 0);

  return {
    workouts: {
      progress: hex.workouts,
      label: "Treinos",
      value: `${workouts.done}/${workouts.target}`,
      detail: workouts.done === 1 ? "treino na semana" : "treinos na semana",
    },
    meals: {
      progress: hex.meals,
      label: "Alimentação",
      value: `${meals.pct}%`,
      detail: `${meals.done} de ${meals.planned} refeições no plano`,
    },
    habits: {
      progress: hex.habits,
      label: "Hábitos",
      value: `${toPct(hex.habits)}%`,
      detail: hex.habitParts.length === 0 ? "sem hábitos do sistema" : hex.habitParts.map(habitDetail).join(" · "),
    },
    empty,
  };
}
