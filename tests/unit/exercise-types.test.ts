import { describe, expect, it } from "vitest";
import {
  countsForRecords,
  EXERCISE_TYPES,
  FIELDS,
  hasLoadAndReps,
  isSetComplete,
  RECORD_KINDS,
  REQUIRED,
  SET_TYPES,
  toExerciseType,
  toSetType,
  type ExerciseType,
} from "@/lib/domain/exercise-types";

const set = (v: { weightKg?: number | null; reps?: number | null; distanceM?: number | null; durationS?: number | null }) => ({
  weightKg: v.weightKg ?? null,
  reps: v.reps ?? null,
  distanceM: v.distanceM ?? null,
  durationS: v.durationS ?? null,
});

describe("tipos de exercício", () => {
  it("os 8 tipos do Hevy, com os campos de cada um", () => {
    expect(EXERCISE_TYPES).toHaveLength(8);
    expect(FIELDS).toEqual({
      weight_reps: ["weight", "reps"],
      reps_only: ["reps"],
      bodyweight_reps: ["weight", "reps"],
      bodyweight_assisted_reps: ["weight", "reps"],
      duration: ["duration"],
      weight_duration: ["weight", "duration"],
      distance_duration: ["distance", "duration"],
      short_distance_weight: ["weight", "distance"],
    });
  });

  it("os campos obrigatórios são sempre um subconjunto dos campos do tipo", () => {
    for (const type of EXERCISE_TYPES) {
      expect(REQUIRED[type].every((f) => FIELDS[type].includes(f))).toBe(true);
    }
  });

  it("tipos e séries desconhecidos caem no padrão (dados antigos ou importados)", () => {
    expect(toExerciseType("duration")).toBe("duration");
    expect(toExerciseType(null)).toBe("weight_reps");
    expect(toExerciseType("cardio")).toBe("weight_reps");
    expect(SET_TYPES).toEqual(["normal", "warmup", "failure", "dropset"]);
    expect(toSetType("warmup")).toBe("warmup");
    expect(toSetType(undefined)).toBe("normal");
    expect(toSetType("x")).toBe("normal");
  });
});

describe("isSetComplete", () => {
  const cases: [ExerciseType, ReturnType<typeof set>, boolean][] = [
    ["weight_reps", set({ weightKg: 60, reps: 10 }), true],
    ["weight_reps", set({ weightKg: 0, reps: 15 }), true],
    ["weight_reps", set({ reps: 10 }), false],
    ["weight_reps", set({ weightKg: 60, reps: 8.5 }), false],
    ["reps_only", set({ reps: 12 }), true],
    ["reps_only", set({}), false],
    ["bodyweight_reps", set({ reps: 8 }), true], // carga extra é opcional
    ["bodyweight_reps", set({ weightKg: 10, reps: 8 }), true],
    ["bodyweight_assisted_reps", set({ weightKg: 20, reps: 8 }), true],
    ["duration", set({ durationS: 60 }), true],
    ["duration", set({ durationS: 0 }), false],
    ["duration", set({}), false],
    ["weight_duration", set({ weightKg: 20, durationS: 45 }), true],
    ["weight_duration", set({ weightKg: 20 }), false],
    ["distance_duration", set({ distanceM: 2000, durationS: 720 }), true],
    ["distance_duration", set({ durationS: 600 }), true], // basta uma das duas
    ["distance_duration", set({ distanceM: 1500 }), true],
    ["distance_duration", set({}), false],
    ["short_distance_weight", set({ weightKg: 32, distanceM: 40 }), true],
    ["short_distance_weight", set({ weightKg: 32 }), false],
  ];

  it.each(cases)("%s %o → %s", (type, value, expected) => {
    expect(isSetComplete(type, value)).toBe(expected);
  });

  it("valor inválido num campo do tipo invalida a série, mesmo opcional", () => {
    expect(isSetComplete("bodyweight_reps", set({ weightKg: -5, reps: 8 }))).toBe(false);
    expect(isSetComplete("distance_duration", set({ distanceM: -1, durationS: 600 }))).toBe(false);
  });

  it("campos de fora do tipo são ignorados", () => {
    expect(isSetComplete("duration", set({ durationS: 60, reps: 0 }))).toBe(true);
  });
});

describe("recordes", () => {
  it("aquecimento não conta; as demais séries contam", () => {
    expect(countsForRecords({ set_type: "warmup" })).toBe(false);
    expect(countsForRecords({ set_type: "normal" })).toBe(true);
    expect(countsForRecords({ set_type: "failure" })).toBe(true);
    expect(countsForRecords({ set_type: "dropset" })).toBe(true);
    expect(countsForRecords({})).toBe(true);
  });

  it("carga, volume e 1RM só com carga e reps", () => {
    expect(hasLoadAndReps(set({ weightKg: 40, reps: 10 }))).toBe(true);
    expect(hasLoadAndReps(set({ reps: 10 }))).toBe(false);
    expect(hasLoadAndReps(set({ weightKg: 20, durationS: 30 }))).toBe(false);
  });

  it("tipos de recorde por tipo de exercício", () => {
    expect(RECORD_KINDS.weight_reps).toEqual(["weight", "volume", "e1rm"]);
    expect(RECORD_KINDS.bodyweight_reps).toEqual(["weight", "volume", "e1rm"]);
    expect(RECORD_KINDS.bodyweight_assisted_reps).toEqual([]); // menos assistência é melhor: sem PR de carga
    expect(RECORD_KINDS.reps_only).toEqual([]);
    expect(RECORD_KINDS.duration).toEqual(["duration"]);
    expect(RECORD_KINDS.weight_duration).toEqual(["duration"]);
    expect(RECORD_KINDS.distance_duration).toEqual(["distance"]);
    expect(RECORD_KINDS.short_distance_weight).toEqual(["distance"]);
  });
});
