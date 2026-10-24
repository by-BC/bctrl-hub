import { describe, expect, it } from "vitest";
import {
  changedPositions,
  filterExercises,
  findDuplicateExercise,
  formatRest,
  moveById,
  nextPosition,
  normalizePositions,
  removeById,
  reorder,
  routineTotals,
} from "@/features/routines/domain/routines";
import { exerciseFormSchema, routineExerciseFormSchema, routineFormSchema } from "@/features/routines/schemas/routine";

const items = (...ids: string[]) => ids.map((id, i) => ({ id, position: (i + 1) * 10 }));
const order = (list: { id: string }[]) => list.map((i) => i.id).join("");
const positions = (list: { position: number }[]) => list.map((i) => i.position);

describe("reordenação", () => {
  it("normaliza posições com buracos para 1..n mantendo a ordem", () => {
    const out = normalizePositions([
      { id: "c", position: 30 },
      { id: "a", position: 2 },
      { id: "b", position: 7 },
    ]);
    expect(order(out)).toBe("abc");
    expect(positions(out)).toEqual([1, 2, 3]);
  });

  it("move para baixo e para cima recalculando position sem buracos", () => {
    const down = reorder(items("a", "b", "c", "d"), 0, 2);
    expect(order(down)).toBe("bcad");
    expect(positions(down)).toEqual([1, 2, 3, 4]);

    const up = reorder(items("a", "b", "c", "d"), 3, 0);
    expect(order(up)).toBe("dabc");
    expect(positions(up)).toEqual([1, 2, 3, 4]);
  });

  it("limita índices às pontas e não muta a entrada", () => {
    const input = items("a", "b", "c");
    const out = reorder(input, 0, 99);
    expect(order(out)).toBe("bca");
    expect(positions(input)).toEqual([10, 20, 30]);
    expect(reorder([], 0, 1)).toEqual([]);
  });

  it("moveById sobe/desce uma casa e ignora as pontas", () => {
    expect(order(moveById(items("a", "b", "c"), "b", -1))).toBe("bac");
    expect(order(moveById(items("a", "b", "c"), "b", 1))).toBe("acb");
    expect(order(moveById(items("a", "b", "c"), "a", -1))).toBe("abc");
    expect(order(moveById(items("a", "b", "c"), "c", 1))).toBe("abc");
    expect(order(moveById(items("a", "b"), "x", 1))).toBe("ab");
  });

  it("removeById fecha o buraco", () => {
    const out = removeById(items("a", "b", "c"), "b");
    expect(order(out)).toBe("ac");
    expect(positions(out)).toEqual([1, 2]);
  });

  it("nextPosition vai para o fim (1 em lista vazia)", () => {
    expect(nextPosition([])).toBe(1);
    expect(nextPosition(items("a", "b"))).toBe(21);
  });

  it("changedPositions devolve só o que mudou", () => {
    const before = normalizePositions(items("a", "b", "c", "d"));
    const after = reorder(before, 1, 2);
    expect(order(changedPositions(before, after))).toBe("cb");
  });

  it("routineTotals soma exercícios e séries", () => {
    expect(routineTotals([{ sets: 3 }, { sets: 4 }])).toEqual({ exercises: 2, sets: 7 });
    expect(routineTotals([])).toEqual({ exercises: 0, sets: 0 });
  });
});

describe("biblioteca de exercícios", () => {
  const library = [
    { id: "1", name: "Supino reto", muscle_group: "Peito" },
    { id: "2", name: "Remada unilateral", muscle_group: "Costas" },
    { id: "3", name: "Elevação lateral", muscle_group: "Ombro" },
  ];

  it("detecta nome duplicado ignorando maiúsculas, acentos e espaços", () => {
    expect(findDuplicateExercise("  supino   RETO ", library)?.id).toBe("1");
    expect(findDuplicateExercise("Elevacao lateral", library)?.id).toBe("3");
    expect(findDuplicateExercise("Supino inclinado", library)).toBeUndefined();
    expect(findDuplicateExercise("   ", library)).toBeUndefined();
  });

  it("na edição, o próprio exercício não conta como duplicado", () => {
    expect(findDuplicateExercise("Supino reto", library, "1")).toBeUndefined();
    expect(findDuplicateExercise("Supino reto", library, "2")?.id).toBe("1");
  });

  it("busca por palavras no nome ou no grupo, em ordem alfabética", () => {
    expect(filterExercises(library, "").map((e) => e.id)).toEqual(["3", "2", "1"]);
    expect(filterExercises(library, "costas").map((e) => e.id)).toEqual(["2"]);
    expect(filterExercises(library, "lat elev").map((e) => e.id)).toEqual(["3"]);
    expect(filterExercises(library, "agachamento")).toEqual([]);
  });

  it("formata o descanso em m:ss", () => {
    expect(formatRest(120)).toBe("2:00");
    expect(formatRest(75)).toBe("1:15");
    expect(formatRest(15)).toBe("0:15");
  });
});

describe("validação dos formulários", () => {
  it("rotina: nome obrigatório e descanso entre 15 e 600 s", () => {
    expect(routineFormSchema.safeParse({ name: "Upper 1", rest_sec: 120 }).data).toEqual({
      name: "Upper 1",
      notes: null,
      rest_sec: 120,
    });
    expect(routineFormSchema.safeParse({ name: "  ", rest_sec: 120 }).success).toBe(false);
    expect(routineFormSchema.safeParse({ name: "A", rest_sec: 14 }).success).toBe(false);
    expect(routineFormSchema.safeParse({ name: "A", rest_sec: 15 }).success).toBe(true);
    expect(routineFormSchema.safeParse({ name: "A", rest_sec: 600 }).success).toBe(true);
    expect(routineFormSchema.safeParse({ name: "A", rest_sec: 601 }).success).toBe(false);
    expect(routineFormSchema.safeParse({ name: "A", rest_sec: 90.5 }).success).toBe(false);
  });

  it("rotina: observação vazia vira null", () => {
    expect(routineFormSchema.parse({ name: "A", rest_sec: 60, notes: "   " }).notes).toBeNull();
    expect(routineFormSchema.parse({ name: "A", rest_sec: 60, notes: " Pausa no peito " }).notes).toBe(
      "Pausa no peito",
    );
  });

  it("exercício da rotina: séries ≥ 1 e descanso próprio ou null", () => {
    expect(routineExerciseFormSchema.safeParse({ sets: 1, rest_sec: null }).success).toBe(true);
    expect(routineExerciseFormSchema.safeParse({ sets: 0, rest_sec: null }).success).toBe(false);
    expect(routineExerciseFormSchema.safeParse({ sets: 2.5, rest_sec: null }).success).toBe(false);
    expect(routineExerciseFormSchema.safeParse({ sets: 21, rest_sec: null }).success).toBe(false);
    expect(routineExerciseFormSchema.safeParse({ sets: 3, rest_sec: 10 }).success).toBe(false);
    expect(routineExerciseFormSchema.safeParse({ sets: 3, rest_sec: 700 }).success).toBe(false);
    const sets = routineExerciseFormSchema.safeParse({ sets: 0, rest_sec: null });
    expect(sets.error?.issues[0].message).toBe("A rotina precisa de ao menos 1 série.");
  });

  it("exercício da biblioteca: nome obrigatório, grupo opcional", () => {
    expect(exerciseFormSchema.parse({ name: " Supino ", muscle_group: "" })).toEqual({
      name: "Supino",
      muscle_group: null,
    });
    expect(exerciseFormSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
