import { describe, expect, it } from "vitest";
import { finishWorkoutSchema } from "@/lib/schemas/workout";

const uuid = () => crypto.randomUUID();

function valid() {
  return {
    id: uuid(),
    routine_id: uuid(),
    started_at: "2026-10-13T10:00:00.000Z",
    finished_at: "2026-10-13T11:05:00-03:00",
    day: "2026-10-13",
    notes: null,
    exercises: [
      {
        id: uuid(),
        exercise_id: uuid(),
        sets: [
          { id: uuid(), weight_kg: 40, reps: 12, pr_kinds: [] },
          { weight_kg: 0, reps: 15 },
          { weight_kg: 52.5, reps: 8, pr_kinds: ["weight", "e1rm"] },
        ],
      },
    ],
  };
}

describe("finishWorkoutSchema", () => {
  it("aceita um payload válido e completa os padrões", () => {
    const parsed = finishWorkoutSchema.parse(valid());
    expect(parsed.exercises[0].sets[1].pr_kinds).toEqual([]);
    expect(parsed.exercises[0].sets[2].weight_kg).toBe(52.5);
  });

  it("aceita treino livre (sem rotina)", () => {
    expect(finishWorkoutSchema.safeParse({ ...valid(), routine_id: null }).success).toBe(true);
  });

  it("rejeita carga negativa", () => {
    const p = valid();
    p.exercises[0].sets[0].weight_kg = -1;
    expect(finishWorkoutSchema.safeParse(p).success).toBe(false);
  });

  it("rejeita reps não inteiras ou zeradas", () => {
    const fractional = valid();
    fractional.exercises[0].sets[0].reps = 8.5;
    expect(finishWorkoutSchema.safeParse(fractional).success).toBe(false);

    const zero = valid();
    zero.exercises[0].sets[0].reps = 0;
    expect(finishWorkoutSchema.safeParse(zero).success).toBe(false);
  });

  it("rejeita lista de exercícios vazia", () => {
    expect(finishWorkoutSchema.safeParse({ ...valid(), exercises: [] }).success).toBe(false);
  });

  it("rejeita exercício sem séries", () => {
    const p = valid();
    p.exercises[0].sets = [];
    expect(finishWorkoutSchema.safeParse(p).success).toBe(false);
  });

  it("rejeita tipo de PR desconhecido", () => {
    const p = valid();
    p.exercises[0].sets[0].pr_kinds = ["sorte"] as never;
    expect(finishWorkoutSchema.safeParse(p).success).toBe(false);
  });

  it("rejeita fim antes do início", () => {
    const result = finishWorkoutSchema.safeParse({ ...valid(), finished_at: "2026-10-13T09:00:00Z" });
    expect(result.success).toBe(false);
  });

  it("aceita rotina e exercício com ids do seed (md5, sem versão RFC)", () => {
    const seedId = "0cc175b9-c0f1-b6a8-31c3-99e269772661";
    const p = valid();
    p.routine_id = seedId;
    p.exercises[0].exercise_id = seedId;
    expect(finishWorkoutSchema.safeParse(p).success).toBe(true);
  });

  it("rejeita ids e datas malformados", () => {
    expect(finishWorkoutSchema.safeParse({ ...valid(), id: "abc" }).success).toBe(false);
    expect(finishWorkoutSchema.safeParse({ ...valid(), day: "13/10/2026" }).success).toBe(false);
  });
});
