import { describe, expect, it } from "vitest";
import {
  detectPrs,
  isCountable,
  e1rm,
  markSessionPrs,
  mergeBests,
  nextRoutineId,
  setVolume,
  summarizeSession,
  type Bests,
  type SetEntry,
} from "@/lib/domain/workout";

const done = (weightKg: number | null, reps: number | null): SetEntry => ({ weightKg, reps, done: true });
const bests = (maxWeight: number, maxSetVolume: number, maxE1rm: number): Bests => ({
  maxWeight,
  maxSetVolume,
  maxE1rm,
});

describe("e1rm (Epley)", () => {
  it("reps <= 1 devolve a própria carga", () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 0)).toBe(100);
  });

  it("aplica kg × (1 + reps/30)", () => {
    expect(e1rm(100, 10)).toBeCloseTo(133.333, 3);
    expect(e1rm(60, 30)).toBe(120);
  });
});

describe("setVolume", () => {
  it("carga × reps, zero se faltar algum valor", () => {
    expect(setVolume(done(40, 12))).toBe(480);
    expect(setVolume(done(null, 12))).toBe(0);
    expect(setVolume(done(40, null))).toBe(0);
  });
});

describe("detectPrs", () => {
  const current = bests(50, 500, 66.67); // 50 × 10 → e1rm 66,67

  it("primeiro registro do exercício (sem bests) não é PR", () => {
    expect(detectPrs(done(80, 10), null)).toEqual([]);
  });

  it("empate não é PR", () => {
    expect(detectPrs(done(50, 10), bests(50, 500, e1rm(50, 10)))).toEqual([]);
  });

  it("mais carga com as mesmas reps bate os três recordes", () => {
    expect(detectPrs(done(55, 10), current)).toEqual(["weight", "volume", "e1rm"]);
  });

  it("PR só de volume: mesma carga máxima, mais volume, e1RM igual ou menor", () => {
    // 40 × 13 = 520 > 500; e1rm 57,3 < 66,67; carga 40 < 50
    expect(detectPrs(done(40, 13), current)).toEqual(["volume"]);
  });

  it("PR só de carga (série pesada e curta)", () => {
    // 52 × 1 = 52 de volume; e1rm 52
    expect(detectPrs(done(52, 1), current)).toEqual(["weight"]);
  });

  it("reps nulas ou zeradas, carga nula ou série não concluída: nenhum PR", () => {
    expect(detectPrs(done(200, null), current)).toEqual([]);
    expect(detectPrs(done(200, 0), current)).toEqual([]);
    expect(detectPrs(done(null, 20), current)).toEqual([]);
    expect(detectPrs({ weightKg: 200, reps: 10, done: false }, current)).toEqual([]);
  });
});

describe("mergeBests", () => {
  it("atualiza só o que a série superou", () => {
    expect(mergeBests(bests(50, 500, 66), done(40, 15))).toEqual(bests(50, 600, 66));
  });

  it("sem bests, a série vira a referência", () => {
    expect(mergeBests(null, done(40, 10))).toEqual(bests(40, 400, e1rm(40, 10)));
  });

  it("série incompleta não muda nada", () => {
    expect(mergeBests(bests(1, 2, 3), done(null, 10))).toEqual(bests(1, 2, 3));
    expect(mergeBests(null, done(10, null))).toBeNull();
  });
});

describe("markSessionPrs", () => {
  it("compara cada série com os recordes + as séries anteriores da sessão", () => {
    const sets = [done(55, 10), done(55, 10), done(57.5, 10), { weightKg: 90, reps: 10, done: false }];
    expect(markSessionPrs(sets, bests(50, 500, e1rm(50, 10)))).toEqual([
      ["weight", "volume", "e1rm"],
      [], // empate com a série anterior
      ["weight", "volume", "e1rm"],
      [], // não concluída
    ]);
  });

  it("exercício sem histórico não marca PR na primeira sessão", () => {
    expect(markSessionPrs([done(40, 10), done(50, 10)], null)).toEqual([[], []]);
  });
});

describe("summarizeSession", () => {
  it("conta só séries concluídas e válidas e soma volume e PRs", () => {
    const summary = summarizeSession(
      [
        {
          sets: [
            { ...done(40, 10), prs: ["volume"] },
            { ...done(50, 8), prs: ["weight", "e1rm"] },
            { weightKg: 60, reps: 5, done: false, prs: [] },
          ],
        },
        { sets: [{ ...done(0, 15), prs: [] }] },
      ],
      "2026-10-13T10:00:00.000Z",
      "2026-10-13T11:05:30.000Z",
    );
    expect(summary).toEqual({ durationMin: 65, sets: 3, volumeKg: 800, prs: 3 });
  });
});

describe("nextRoutineId", () => {
  const seq = [
    { id: "u1", position: 1 },
    { id: "l1", position: 2 },
    { id: "u2", position: 3 },
    { id: "l2", position: 4 },
  ];

  it("sem histórico sugere a primeira rotina", () => {
    expect(nextRoutineId(seq, null)).toBe("u1");
  });

  it("segue a sequência pela position, não pela ordem do array", () => {
    expect(nextRoutineId([...seq].reverse(), "u1")).toBe("l1");
    expect(nextRoutineId(seq, "l1")).toBe("u2");
  });

  it("volta de L2 para U1", () => {
    expect(nextRoutineId(seq, "l2")).toBe("u1");
  });

  it("rotina arquivada é ignorada na sequência", () => {
    const withArchived = seq.map((r) => (r.id === "u2" ? { ...r, archivedAt: "2026-10-01T00:00:00Z" } : r));
    expect(nextRoutineId(withArchived, "l1")).toBe("l2");
    // A última sessão foi de uma rotina que depois foi arquivada: segue a partir da posição dela.
    expect(nextRoutineId(withArchived, "u2")).toBe("l2");
    const firstArchived = seq.map((r) => (r.id === "u1" ? { ...r, archivedAt: "2026-10-01T00:00:00Z" } : r));
    expect(nextRoutineId(firstArchived, null)).toBe("l1");
    expect(nextRoutineId(firstArchived, "l2")).toBe("l1");
  });

  it("última rotina excluída (fora da lista): recomeça pela primeira", () => {
    expect(nextRoutineId(seq, "apagada")).toBe("u1");
  });

  it("nenhuma rotina ativa: null", () => {
    expect(nextRoutineId([], null)).toBeNull();
    expect(nextRoutineId([{ id: "x", position: 1, archivedAt: "2026-10-01T00:00:00Z" }], "x")).toBeNull();
  });
});

// ── v2: tipos de série e de exercício ─────────────────────────────────────

const warmup = (weightKg: number, reps: number): SetEntry => ({ weightKg, reps, done: true, setType: "warmup" });
const timed = (durationS: number | null, extra: Partial<SetEntry> = {}): SetEntry => ({
  weightKg: null,
  reps: null,
  durationS,
  done: true,
  ...extra,
});
const ran = (distanceM: number | null, durationS: number | null): SetEntry => ({
  weightKg: null,
  reps: null,
  distanceM,
  durationS,
  done: true,
});

describe("aquecimento", () => {
  it("não gera PR, mesmo superando os recordes", () => {
    expect(detectPrs(warmup(80, 10), bests(50, 500, 66.67))).toEqual([]);
  });

  it("não entra nos recordes da sessão (a série seguinte compara com o histórico)", () => {
    const sets = [warmup(60, 10), done(55, 10)];
    expect(markSessionPrs(sets, bests(50, 500, e1rm(50, 10)))).toEqual([[], ["weight", "volume", "e1rm"]]);
    expect(mergeBests(bests(50, 500, 66), warmup(90, 10))).toEqual(bests(50, 500, 66));
  });

  it("não entra no volume nem na contagem de séries do resumo", () => {
    const summary = summarizeSession(
      [{ sets: [{ ...warmup(40, 10), prs: [] }, { ...done(60, 10), prs: [] }] }],
      "2026-10-13T10:00:00.000Z",
      "2026-10-13T10:30:00.000Z",
    );
    expect(summary).toEqual({ durationMin: 30, sets: 1, volumeKg: 600, prs: 0 });
  });
});

describe("séries sem carga", () => {
  it("só reps: conta como série, sem volume e sem PR de carga", () => {
    const reps: SetEntry = { weightKg: null, reps: 12, done: true };
    expect(isCountable(reps, "reps_only")).toBe(true);
    expect(isCountable(reps)).toBe(false); // carga × reps exige a carga
    expect(detectPrs(reps, bests(50, 500, 60), "reps_only")).toEqual([]);
    const summary = summarizeSession(
      [{ type: "reps_only", sets: [{ ...reps, prs: [] }] }],
      "2026-10-13T10:00:00.000Z",
      "2026-10-13T10:10:00.000Z",
    );
    expect(summary).toMatchObject({ sets: 1, volumeKg: 0 });
  });

  it("peso corporal com carga extra entra nos recordes de carga", () => {
    expect(detectPrs(done(15, 8), bests(10, 80, e1rm(10, 8)), "bodyweight_reps")).toEqual(["weight", "volume", "e1rm"]);
    expect(detectPrs({ weightKg: null, reps: 20, done: true }, bests(10, 80, 12), "bodyweight_reps")).toEqual([]);
  });

  it("assistido não tem PR de carga (menos assistência é melhor)", () => {
    expect(detectPrs(done(40, 10), bests(20, 200, 26), "bodyweight_assisted_reps")).toEqual([]);
  });
});

describe("recordes de duração e distância", () => {
  it("duração: PR quando passa do maior tempo; empate não", () => {
    const b: Bests = { maxDurationS: 60 };
    expect(isCountable(timed(75), "duration")).toBe(true);
    expect(detectPrs(timed(75), b, "duration")).toEqual(["duration"]);
    expect(detectPrs(timed(60), b, "duration")).toEqual([]);
    expect(detectPrs(timed(90, { setType: "warmup" }), b, "duration")).toEqual([]);
  });

  it("primeira vez no exercício não é PR, e cada métrica precisa da própria referência", () => {
    expect(detectPrs(timed(75), null, "duration")).toEqual([]);
    expect(detectPrs(timed(75), bests(50, 500, 60), "duration")).toEqual([]);
  });

  it("distância: PR pela maior distância (corrida)", () => {
    const b: Bests = { maxDistanceM: 2000, maxDurationS: 900 };
    expect(detectPrs(ran(2500, 800), b, "distance_duration")).toEqual(["distance"]);
    expect(detectPrs(ran(2000, 600), b, "distance_duration")).toEqual([]);
  });

  it("mergeBests acompanha duração e distância sem inventar carga", () => {
    expect(mergeBests(null, timed(60))).toEqual({ maxDurationS: 60 });
    expect(mergeBests({ maxDurationS: 60 }, timed(45))).toEqual({ maxDurationS: 60 });
    expect(mergeBests({ maxDistanceM: 2000 }, ran(2500, 700))).toEqual({ maxDistanceM: 2500, maxDurationS: 700 });
  });

  it("markSessionPrs por tipo: a 2ª prancha compara com a 1ª da sessão", () => {
    expect(markSessionPrs([timed(70), timed(65), timed(80)], { maxDurationS: 60 }, "duration")).toEqual([
      ["duration"],
      [],
      ["duration"],
    ]);
  });

  it("resumo conta séries de duração e distância e os PRs delas", () => {
    const summary = summarizeSession(
      [
        { type: "duration", sets: [{ ...timed(60), prs: ["duration"] }] },
        { type: "distance_duration", sets: [{ ...ran(2000, 720), prs: [] }] },
      ],
      "2026-10-13T10:00:00.000Z",
      "2026-10-13T10:40:00.000Z",
    );
    expect(summary).toEqual({ durationMin: 40, sets: 2, volumeKg: 0, prs: 1 });
  });
});
