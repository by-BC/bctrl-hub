/**
 * Story do treino: transforma um treino finalizado (+ o resumo da semana) no `StoryData`
 * que os layouts do Story Studio desenham em 1080×1920. Puro, sem I/O.
 */

import { toPct, weekHex, type HexSegmentKey, type WeekHexInput } from "@/lib/domain/hex";
import { e1rm, isCountable, summarizeSession, type PrKind } from "@/lib/domain/workout";

/** Vagas de exercício no story. Com mais que isso, a última vaga vira a linha "+N". */
export const STORY_MAX_EXERCISES = 6;

const PR_ORDER: readonly PrKind[] = ["weight", "volume", "e1rm"];

export type StoryWorkoutInput = {
  routineName: string | null;
  /** Dia do treino (AAAA-MM-DD). */
  day: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: readonly {
    name: string;
    muscleGroup?: string | null;
    secondaryMuscles?: readonly string[];
    sets: readonly { weightKg: number; reps: number; prs: readonly string[] }[];
  }[];
};

export type StoryWeekInput = WeekHexInput & { days?: readonly { day: string; trained: boolean }[] };

export type StorySet = { kg: number; reps: number; prs: PrKind[] };

export type StoryExercise = {
  name: string;
  /** Maior carga; no empate, mais repetições. */
  best: { kg: number; reps: number };
  sets: StorySet[];
  /** kg inteiros. */
  volumeKg: number;
  hasPr: boolean;
};

export type StoryPr = { exercise: string; kind: PrKind; kg: number; reps: number; value: number };

export type StoryWeek = {
  workouts: number;
  workoutsTarget: number;
  mealsPct: number;
  habitsPct: number;
  /** 0–1 de cada segmento do Hex Week. */
  progress: Record<HexSegmentKey, number>;
  days: { day: string; trained: boolean }[];
};

export type StoryData = {
  routineName: string;
  /** AAAA-MM-DD. */
  date: string;
  durationMin: number;
  /** Volume total em kg inteiros (todos os exercícios, inclusive os resumidos no "+N"). */
  volumeKg: number;
  setsCount: number;
  /** Exercícios mostrados (no máximo `STORY_MAX_EXERCISES`). */
  exercises: StoryExercise[];
  /** Quantos ficaram de fora ("+N"). */
  hiddenExercises: number;
  prs: StoryPr[];
  muscles: string[];
  week: StoryWeek | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const isPrKind = (k: string): k is PrKind => (PR_ORDER as readonly string[]).includes(k);

function prValue(kind: PrKind, set: StorySet): number {
  if (kind === "weight") return set.kg;
  if (kind === "volume") return round2(set.kg * set.reps);
  return round1(e1rm(set.kg, set.reps));
}

function toExercise(name: string, sets: StorySet[]): StoryExercise {
  let best = sets[0];
  for (const s of sets) {
    if (s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) best = s;
  }
  return {
    name,
    best: { kg: best.kg, reps: best.reps },
    sets,
    volumeKg: Math.round(sets.reduce((sum, s) => sum + s.kg * s.reps, 0)),
    hasPr: sets.some((s) => s.prs.length > 0),
  };
}

/** Um recorde por exercício e tipo: o de maior valor, na ordem carga → volume → 1RM. */
function exercisePrs(exercise: StoryExercise): StoryPr[] {
  const prs: StoryPr[] = [];
  for (const kind of PR_ORDER) {
    let top: StoryPr | null = null;
    for (const s of exercise.sets) {
      if (!s.prs.includes(kind)) continue;
      const value = prValue(kind, s);
      if (!top || value > top.value) top = { exercise: exercise.name, kind, kg: s.kg, reps: s.reps, value };
    }
    if (top) prs.push(top);
  }
  return prs;
}

function toWeek(input: StoryWeekInput): StoryWeek {
  const hex = weekHex(input);
  return {
    workouts: input.workouts.done,
    workoutsTarget: input.workouts.target,
    mealsPct: Math.round(input.meals.pct),
    habitsPct: toPct(hex.habits),
    progress: { workouts: hex.workouts, meals: hex.meals, habits: hex.habits },
    days: (input.days ?? []).map((d) => ({ day: d.day, trained: d.trained })),
  };
}

export function buildStoryData(workout: StoryWorkoutInput, week: StoryWeekInput | null): StoryData {
  const all: StoryExercise[] = [];
  for (const exercise of workout.exercises) {
    const sets: StorySet[] = exercise.sets
      .filter((s) => isCountable({ weightKg: s.weightKg, reps: s.reps, done: true }))
      .map((s) => ({ kg: s.weightKg, reps: s.reps, prs: s.prs.filter(isPrKind) }));
    if (sets.length > 0) all.push(toExercise(exercise.name, sets));
  }

  const summary = summarizeSession(
    all.map((e) => ({ sets: e.sets.map((s) => ({ weightKg: s.kg, reps: s.reps, done: true, prs: s.prs })) })),
    workout.startedAt,
    workout.finishedAt ?? workout.startedAt,
  );

  const shown = all.length > STORY_MAX_EXERCISES ? all.slice(0, STORY_MAX_EXERCISES - 1) : all;

  return {
    routineName: workout.routineName ?? "Treino livre",
    date: workout.day,
    durationMin: summary.durationMin,
    volumeKg: Math.round(summary.volumeKg),
    setsCount: summary.sets,
    exercises: shown,
    hiddenExercises: all.length - shown.length,
    prs: all.flatMap(exercisePrs),
    muscles: [...new Set(workout.exercises.flatMap((exercise) => [exercise.muscleGroup, ...(exercise.secondaryMuscles ?? [])]).filter((muscle): muscle is string => !!muscle?.trim()).map((muscle) => muscle.trim()))],
    week: week ? toWeek(week) : null,
  };
}
