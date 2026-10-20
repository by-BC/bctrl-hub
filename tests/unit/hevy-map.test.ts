import { describe, expect, it } from "vitest";
import ptFixture from "../fixtures/hevy/catalog-pt.json";
import templatesFixture from "../fixtures/hevy/exercise_templates.json";
import workoutsFixture from "../fixtures/hevy/workouts.json";
import {
  assignPrs,
  buildImportSql,
  dayInSaoPaulo,
  isCustomTemplateId,
  linkExisting,
  normalizeName,
  parseSeedExercises,
  parseSeedOwnerEmail,
  planImport,
  resolveCatalogNames,
  templateToExercise,
  workoutToRows,
  type ExerciseRow,
  type HevyTemplate,
  type HevyWorkout,
  type PtCatalog,
} from "../../scripts/hevy/map";
import type { ExerciseType } from "@/lib/domain/exercise-types";

const templates = templatesFixture.exercise_templates as HevyTemplate[];
const workouts = workoutsFixture.workouts as HevyWorkout[];
const pt = ptFixture as PtCatalog;

const template = (id: string) => templates.find((t) => t.id === id)!;
const workout = (id: string) => workouts.find((w) => w.id === id)!;
const catalog = () => templates.map((t) => templateToExercise(t, pt[t.id]));
const typeByTemplate = () => new Map<string, ExerciseType>(catalog().map((c) => [c.hevy_template_id, c.exercise_type]));

describe("normalizeName", () => {
  it("ignora acento, caixa, pontuação e espaços repetidos", () => {
    expect(normalizeName("  Mesa Flexora (Máquina) ")).toBe("mesa flexora maquina");
    expect(normalizeName("mesa  flexora - maquina")).toBe("mesa flexora maquina");
    expect(normalizeName("Leg press 45°")).toBe("leg press 45");
  });
});

describe("isCustomTemplateId", () => {
  it("reconhece o id em formato UUID dos personalizados", () => {
    expect(isCustomTemplateId("6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f")).toBe(true);
    expect(isCustomTemplateId("79D0BB3A")).toBe(false);
  });
});

describe("dayInSaoPaulo", () => {
  it("converte o instante UTC para o dia em America/Sao_Paulo", () => {
    expect(dayInSaoPaulo("2026-03-02T01:30:00+00:00")).toBe("2026-03-01");
    expect(dayInSaoPaulo("2026-03-05T12:00:00+00:00")).toBe("2026-03-05");
    expect(dayInSaoPaulo("2026-03-03T02:59:59Z")).toBe("2026-03-02");
    expect(dayInSaoPaulo("2026-03-03T03:00:00Z")).toBe("2026-03-03");
  });
});

describe("templateToExercise", () => {
  it("usa o nome em PT, o vídeo e traduz músculo e equipamento", () => {
    expect(templateToExercise(template("79D0BB3A"), pt["79D0BB3A"])).toEqual({
      hevy_template_id: "79D0BB3A",
      name: "Supino Reto (Barra)",
      name_en: "Bench Press (Barbell)",
      has_pt: true,
      muscle_group: "Peito",
      secondary_muscles: ["Tríceps", "Ombros"],
      exercise_type: "weight_reps",
      equipment: "Barra",
      thumbnail_url: "https://cdn.example.test/exercise-thumbnails/bench-press-barbell.jpg",
      media_url: "https://cdn.example.test/exercise-assets/bench-press-barbell.mp4",
      instructions: null,
      source: "hevy",
    });
  });

  it("sem nome em PT, fica o nome em inglês (e sinaliza)", () => {
    const row = templateToExercise(template("0FAB1E00"), undefined);
    expect(row).toMatchObject({ name: "Fictional Press (Machine)", has_pt: false, media_url: null, thumbnail_url: null });
    expect(row.equipment).toBe("Máquina");
  });

  it("personalizado vira source hevy_custom com o nome original", () => {
    const row = templateToExercise(template("6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f"), undefined);
    expect(row).toMatchObject({
      source: "hevy_custom",
      name: "Exercício Personalizado D'Teste",
      exercise_type: "reps_only",
      muscle_group: "Outros",
      equipment: "Nenhum",
    });
  });

  it("aceita instruções próprias e descarta mídia que não é https", () => {
    const row = templateToExercise(
      { ...template("C6C9B8A0"), thumbnail_url: "http://inseguro.test/x.jpg" },
      { pt_br_title: "Prancha", media_url: "ftp://x" },
      "Texto próprio.",
    );
    expect(row).toMatchObject({ exercise_type: "duration", thumbnail_url: null, media_url: null, instructions: "Texto próprio." });
  });

  it("músculos secundários sem repetição (dorsais e costas superiores viram Costas)", () => {
    const row = templateToExercise(template("F1E57334"), pt.F1E57334);
    expect(row.muscle_group).toBe("Costas");
    expect(row.secondary_muscles).toEqual(["Bíceps"]);
  });
});

describe("workoutToRows", () => {
  it("converte datas, séries, aquecimento, distância e duração", () => {
    const { workout: w, skipped } = workoutToRows(workout("a1111111-1111-4111-8111-111111111111"), typeByTemplate());
    expect(skipped).toEqual([]);
    expect(w).toMatchObject({
      hevy_workout_id: "a1111111-1111-4111-8111-111111111111",
      started_at: "2026-03-02T01:30:00.000Z",
      finished_at: "2026-03-02T02:30:00.000Z",
      day: "2026-03-01",
      notes: "Treino A\n\nDescrição fictícia",
    });
    expect(w!.exercises.map((e) => [e.position, e.hevy_template_id, e.notes])).toEqual([
      [1, "79D0BB3A", "Nota fictícia"],
      [2, "C6C9B8A0", null],
      [3, "6f1c2a9e-3b4d-4c5e-8f70-1a2b3c4d5e6f", null],
      [4, "AC1BB830", null],
    ]);
    expect(w!.exercises[0].sets.map((s) => [s.position, s.set_type, s.weight_kg, s.reps])).toEqual([
      [1, "warmup", 40, 10],
      [2, "normal", 60, 8],
      [3, "normal", 62.5, 6],
      [4, "failure", 60, 9],
    ]);
    expect(w!.exercises[1].sets[0]).toMatchObject({ weight_kg: null, reps: null, distance_m: null, duration_s: 60 });
    expect(w!.exercises[3].sets[0]).toMatchObject({ distance_m: 2000, duration_s: 720 });
  });

  it("ignora série sem métrica e exercício sem modelo conhecido, com motivo", () => {
    const { workout: w, skipped } = workoutToRows(workout("a2222222-2222-4222-8222-222222222222"), typeByTemplate());
    expect(w!.notes).toBe("Treino B");
    expect(w!.exercises.map((e) => e.hevy_template_id)).toEqual(["79D0BB3A", "C6C9B8A0", "AC1BB830"]);
    expect(w!.exercises[0].sets).toHaveLength(2);
    expect(skipped).toEqual([
      expect.objectContaining({ kind: "série", reason: expect.stringMatching(/sem nenhuma métrica/) }),
      expect.objectContaining({ kind: "exercício", reason: expect.stringMatching(/DEADBEEF/) }),
    ]);
  });

  it("reps 0 vira nulo e dropset é mantido", () => {
    const { workout: w } = workoutToRows(workout("a3333333-3333-4333-8333-333333333333"), typeByTemplate());
    expect(w!.day).toBe("2026-03-03");
    expect(w!.exercises[0].sets.map((s) => [s.set_type, s.weight_kg, s.reps])).toEqual([
      ["normal", 50, null],
      ["dropset", 40, 10],
    ]);
  });

  it("treino sem nenhum exercício importável é ignorado", () => {
    const { workout: w, skipped } = workoutToRows(workout("a4444444-4444-4444-8444-444444444444"), typeByTemplate());
    expect(w).toBeNull();
    expect(skipped.at(-1)).toMatchObject({ kind: "treino", reason: expect.stringMatching(/nenhum exercício/) });
  });
});

describe("assignPrs", () => {
  it("calcula os recordes em ordem cronológica, sem aquecimento e sem empate", () => {
    const types = typeByTemplate();
    const rows = workouts.map((w) => workoutToRows(w, types).workout).filter((w) => w !== null);
    const ordered = assignPrs(rows, types);
    expect(ordered.map((w) => w.day)).toEqual(["2026-03-01", "2026-03-03", "2026-03-05"]);

    const [a, , b] = ordered;
    // Primeira sessão só estabelece a referência.
    expect(a.exercises.flatMap((e) => e.sets.map((s) => s.pr_kinds))).toEqual(
      a.exercises.flatMap((e) => e.sets.map(() => [])),
    );
    // Aquecimento de 80 kg não é PR; 65×6 bate a carga (62,5), empata o e1RM (78) e não bate o volume (480).
    expect(b.exercises[0].sets.map((s) => s.pr_kinds)).toEqual([[], ["weight"]]);
    expect(b.exercises[1].sets[0].pr_kinds).toEqual(["duration"]);
    expect(b.exercises[2].sets[0].pr_kinds).toEqual(["distance"]);
  });
});

describe("linkExisting", () => {
  const existing = [
    { name: "Supino Reto (Barra)", muscle_group: "Peito" },
    { name: "mesa flexora maquina", muscle_group: "Posterior de coxa" },
    { name: "Remada unilateral", muscle_group: "Costas" },
    { name: "Crucifixo estranho", muscle_group: "Peito" },
    { name: "Abdominal canivete", muscle_group: "Abdômen" },
    { name: "Prancha isométrica", muscle_group: "Abdômen" },
  ];

  it("vincula por nome exato, depois normalizado, depois override; o resto fica pendente", () => {
    const result = linkExisting(existing, catalog(), { "Remada unilateral": "F1E57334", "Prancha isométrica": null });
    expect(result.links).toEqual([
      { existingName: "mesa flexora maquina", hevyTemplateId: "B8127AD1", catalogName: "Mesa Flexora (Máquina)", method: "normalizado" },
      { existingName: "Remada unilateral", hevyTemplateId: "F1E57334", catalogName: "Remada Serrote (Halter)", method: "override" },
      { existingName: "Supino Reto (Barra)", hevyTemplateId: "79D0BB3A", catalogName: "Supino Reto (Barra)", method: "exato" },
    ]);
    expect(result.kept).toEqual([{ existingName: "Prancha isométrica", reason: expect.stringMatching(/overrides/) }]);
    expect(result.pending.map((p) => [p.existingName, p.reason])).toEqual([
      ["Abdominal canivete", expect.stringMatching(/ambíguo/)],
      ["Crucifixo estranho", expect.stringMatching(/sem equivalente/)],
    ]);
    // Ambíguo lista os candidatos.
    expect(result.pending[0].suggestions.map((s) => s.hevyTemplateId).sort()).toEqual(["32B0B590", "6BE68B62"]);
    expect(result.errors).toEqual([]);
  });

  it("override para um id inexistente vira erro, e dois exercícios no mesmo modelo não passam", () => {
    const result = linkExisting(
      [
        { name: "Supino Reto (Barra)", muscle_group: null },
        { name: "Supino reto (barra)", muscle_group: null },
        { name: "Outro", muscle_group: null },
      ],
      catalog(),
      { Outro: "NAOEXISTE" },
    );
    expect(result.links.map((l) => l.existingName)).toEqual(["Supino Reto (Barra)"]);
    expect(result.pending.map((p) => [p.existingName, p.reason])).toEqual([
      ["Supino reto (barra)", expect.stringMatching(/já vinculado/)],
    ]);
    expect(result.errors).toEqual([expect.stringMatching(/NAOEXISTE/)]);
  });

  it("override que aponta para um nome que não existe no app vira erro", () => {
    const result = linkExisting([], catalog(), { Fantasma: "79D0BB3A" });
    expect(result.errors).toEqual([expect.stringMatching(/Fantasma/)]);
  });
});

describe("resolveCatalogNames", () => {
  it("vinculado herda o nome do app; nomes repetidos ganham o nome em inglês", () => {
    const links = [{ existingName: "Meu supino", hevyTemplateId: "79D0BB3A", catalogName: "Supino Reto (Barra)", method: "override" as const }];
    const { rows, renamed } = resolveCatalogNames(catalog(), [{ name: "Meu supino", muscle_group: null }, { name: "Prancha", muscle_group: null }], links);
    const byId = new Map(rows.map((r) => [r.hevy_template_id, r.name]));
    expect(byId.get("79D0BB3A")).toBe("Meu supino");
    // Repetidos: o primeiro id (ordem alfabética) fica com o nome; os outros ganham o nome em inglês.
    expect(byId.get("32B0B590")).toBe("Abdominal Canivete");
    expect(byId.get("6BE68B62")).toBe("Abdominal Canivete (Jackknife Sit Up)");
    // "Prancha" já existe no app sem vínculo: o do catálogo não pode colidir.
    expect(byId.get("C6C9B8A0")).toBe("Prancha (Plank)");
    expect(renamed.map((r) => r.hevyTemplateId).sort()).toEqual(["6BE68B62", "C6C9B8A0"]);
    expect(new Set(rows.map((r) => r.name.toLowerCase())).size).toBe(rows.length);
  });
});

describe("seed privado", () => {
  const seed = [
    "declare",
    "  v_uid uuid := (select id from auth.users where email = 'dono@exemplo.test');",
    "  insert into public.exercises (id, user_id, name, muscle_group) values",
    "    (md5(v_uid::text || ':exercise:' || 'Supino reto')::uuid, v_uid, 'Supino reto', 'Peito'),",
    "    (md5(v_uid::text || ':exercise:' || 'Leg press 45°')::uuid, v_uid, 'Leg press 45°', 'Quadríceps'),",
    "    (md5(v_uid::text || ':exercise:' || 'Rosca d''ouro')::uuid, v_uid, 'Rosca d''ouro', null);",
  ].join("\n");

  it("lê os exercícios e o e-mail do dono", () => {
    expect(parseSeedExercises(seed)).toEqual([
      { name: "Supino reto", muscle_group: "Peito" },
      { name: "Leg press 45°", muscle_group: "Quadríceps" },
      { name: "Rosca d'ouro", muscle_group: null },
    ]);
    expect(parseSeedOwnerEmail(seed)).toBe("dono@exemplo.test");
  });
});

describe("planImport e buildImportSql", () => {
  const input = () => ({
    templates,
    workouts,
    pt,
    existing: [{ name: "Supino Reto (Barra)", muscle_group: "Peito" }],
    overrides: {},
  });

  it("monta o plano com contagens", () => {
    const plan = planImport(input());
    expect(plan.catalog).toHaveLength(templates.length);
    expect(plan.links.links).toHaveLength(1);
    expect(plan.workouts).toHaveLength(3);
    // Em ordem cronológica: o treino vazio (04/03) vem antes do Treino B (05/03).
    expect(plan.skipped.map((s) => s.kind)).toEqual(["exercício", "treino", "série", "exercício"]);
    expect(plan.stats).toMatchObject({
      templates: 9,
      customTemplates: 1,
      withoutPt: 2,
      workoutsFromApi: 4,
      workoutsImported: 3,
      exercisesImported: 9,
      setsImported: 14,
      warmupSets: 2,
      prs: 3,
    });
  });

  it("gera SQL determinístico, idempotente e com aspas escapadas", () => {
    const a = buildImportSql({ ownerEmail: "dono@exemplo.test", plan: planImport(input()) });
    const shuffled = { ...input(), templates: [...templates].reverse(), workouts: [...workouts].reverse() };
    const b = buildImportSql({ ownerEmail: "dono@exemplo.test", plan: planImport(shuffled) });
    expect(a).toBe(b);
    expect(a).toContain("where email = 'dono@exemplo.test'");
    expect(a).toContain("on conflict (user_id, hevy_template_id) do update");
    expect(a).toContain("on conflict (user_id, hevy_workout_id) do update");
    expect(a).toContain("'Exercício Personalizado D''Teste'");
    expect(a).toContain("'hevy_custom'");
    expect(a).not.toMatch(/DEADBEEF/);
    expect(a.trimEnd().endsWith("$import$;")).toBe(true);
  });

  it("recusa e-mail inválido", () => {
    expect(() => buildImportSql({ ownerEmail: "x'; drop table y; --", plan: planImport(input()) })).toThrow();
  });
});

// Garante que os tipos exportados existem (o teste falha na compilação se mudarem).
export type _Check = ExerciseRow;

describe("renderReport", () => {
  it("traz contagens, vínculos, pendentes e ignorados com motivo", async () => {
    const { renderReport } = await import("../../scripts/hevy/report");
    const plan = planImport({
      templates,
      workouts,
      pt,
      existing: [
        { name: "Supino Reto (Barra)", muscle_group: "Peito" },
        { name: "Crucifixo estranho", muscle_group: "Peito" },
      ],
      overrides: {},
    });
    const md = renderReport(plan, {
      generatedAt: "2026-10-19T00:00:00.000Z",
      mode: "dry-run",
      existingSource: "x.sql",
      existingCount: 2,
      apiWorkoutCount: 4,
    });
    expect(md).toContain("| Treinos a importar | 3 |");
    expect(md).toContain("| Supino Reto (Barra) | 79D0BB3A | Supino Reto (Barra) (Bench Press (Barbell)) | exato |");
    expect(md).toMatch(/\*\*Crucifixo estranho\*\* — sem equivalente por nome/);
    expect(md).toMatch(/\*\*exercício: modelo não está no catálogo da API\*\* \(2\)/);
    expect(md).toContain("nenhum SQL gerado");
  });
});

describe("sugestões de pendentes", () => {
  it("aceitam variação de palavra e desempatam pelo uso no histórico", () => {
    const rows = [
      templateToExercise({ ...template("F1E57334"), id: "AAAA0001" }, { pt_br_title: "Remada Alta (Barra)", media_url: null }),
      templateToExercise({ ...template("F1E57334"), id: "AAAA0002" }, { pt_br_title: "Remada Serrote (Halter)", media_url: null }),
      templateToExercise({ ...template("F1E57334"), id: "AAAA0003" }, { pt_br_title: "Remada Baixa (Cabo)", media_url: null }),
    ];
    const usage = new Map([["AAAA0003", 9]]);
    const { pending } = linkExisting([{ name: "Remada com halteres", muscle_group: null }], rows, {}, usage);
    expect(pending[0].suggestions.map((s) => s.hevyTemplateId)).toEqual(["AAAA0002", "AAAA0003", "AAAA0001"]);
  });
});
