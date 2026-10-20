/**
 * Importação do Hevy: funções puras (sem I/O). API do Hevy + mapa PT → linhas do Bctrl Hub
 * → SQL privado e idempotente. Ver tasks/prd-bctrl-hub-v2/techspec.md (Importação).
 *
 * Idempotência do SQL:
 * - ids determinísticos: md5(user_id || ':hevy-…:' || id do Hevy)::uuid;
 * - `on conflict (user_id, hevy_template_id)` / `(user_id, hevy_workout_id)` atualiza;
 * - séries e exercícios de cada treino são apagados e regravados com os mesmos ids.
 */

import { toExerciseType, toSetType, type ExerciseType, type PrKind, type SetType } from "../../src/lib/domain/exercise-types";
import { markSessionPrs, mergeBests, isCountable, type Bests, type SetEntry } from "../../src/lib/domain/workout";

// ── Formato da API (v1) ──────────────────────────────────────────────────

export type HevyTemplate = {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string | null;
  secondary_muscle_groups: string[] | null;
  equipment: string | null;
  is_custom: boolean;
  thumbnail_url: string | null;
};

export type HevySet = {
  index: number;
  type: string;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe?: number | null;
  custom_metric?: number | null;
};

export type HevyExercise = {
  index: number;
  title: string;
  notes: string | null;
  exercise_template_id: string;
  superset_id: number | null;
  sets: HevySet[];
};

export type HevyWorkout = {
  id: string;
  title: string | null;
  routine_id?: string | null;
  description: string | null;
  start_time: string;
  end_time: string | null;
  exercises: HevyExercise[];
};

/** Mapa extraído do catálogo do site (`scripts/hevy/data/catalog-pt.json`). */
export type PtEntry = { pt_br_title: string | null; media_url: string | null };
export type PtCatalog = Record<string, PtEntry>;

// ── Linhas do Bctrl Hub ──────────────────────────────────────────────────

export type ExerciseSource = "hevy" | "hevy_custom";

export type ExerciseRow = {
  hevy_template_id: string;
  name: string;
  /** Nome original (inglês no catálogo; o do dono nos personalizados). */
  name_en: string;
  has_pt: boolean;
  muscle_group: string | null;
  secondary_muscles: string[];
  exercise_type: ExerciseType;
  equipment: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  instructions: string | null;
  source: ExerciseSource;
};

export type ExistingExercise = { name: string; muscle_group: string | null };

export type ImportedSet = {
  position: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_m: number | null;
  duration_s: number | null;
  pr_kinds: PrKind[];
};

export type ImportedExercise = {
  position: number;
  hevy_template_id: string;
  notes: string | null;
  sets: ImportedSet[];
};

export type ImportedWorkout = {
  hevy_workout_id: string;
  started_at: string;
  finished_at: string;
  day: string;
  notes: string | null;
  exercises: ImportedExercise[];
};

export type Skipped = { kind: "treino" | "exercício" | "série"; ref: string; reason: string };

// ── Traduções (mesmo vocabulário dos 26 exercícios da v1) ────────────────

export const MUSCLE_PT: Record<string, string> = {
  chest: "Peito",
  lats: "Costas",
  upper_back: "Costas",
  lower_back: "Lombar",
  traps: "Trapézio",
  shoulders: "Ombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraço",
  abdominals: "Abdômen",
  quadriceps: "Quadríceps",
  hamstrings: "Posterior de coxa",
  glutes: "Glúteos",
  calves: "Panturrilha",
  adductors: "Adutores",
  abductors: "Abdutores",
  neck: "Pescoço",
  cardio: "Cardio",
  full_body: "Corpo inteiro",
  other: "Outros",
};

export const EQUIPMENT_PT: Record<string, string> = {
  none: "Nenhum",
  barbell: "Barra",
  dumbbell: "Halter",
  kettlebell: "Kettlebell",
  machine: "Máquina",
  plate: "Anilha",
  resistance_band: "Elástico",
  suspension: "Suspensão",
  other: "Outro",
};

const NAME_MAX = 120;
const TIME_ZONE = "America/Sao_Paulo";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const muscle = (key: string | null | undefined) => (key ? (MUSCLE_PT[key] ?? key) : null);
const https = (url: string | null | undefined) => (url && /^https:\/\//.test(url) && url.length <= 1000 ? url : null);
const byText = (a: string, b: string) => a.localeCompare(b, "pt-BR");
const clean = (text: string | null | undefined) => {
  const t = text?.trim();
  return t ? t : null;
};

/** Sem acento, caixa, pontuação e espaços repetidos. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const isCustomTemplateId = (id: string) => UUID_RE.test(id);

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

/** Dia civil em America/Sao_Paulo (yyyy-mm-dd) de um instante ISO. */
export function dayInSaoPaulo(iso: string): string {
  return dayFormat.format(new Date(iso));
}

// ── Exercícios ───────────────────────────────────────────────────────────

export function templateToExercise(t: HevyTemplate, pt?: PtEntry, instructions?: string): ExerciseRow {
  const custom = t.is_custom || isCustomTemplateId(t.id);
  const ptName = custom ? null : clean(pt?.pt_br_title);
  const primary = muscle(t.primary_muscle_group);
  const secondary = [
    ...new Set((t.secondary_muscle_groups ?? []).map(muscle).filter((m): m is string => !!m && m !== primary)),
  ];
  return {
    hevy_template_id: t.id,
    name: (ptName ?? t.title.trim()).slice(0, NAME_MAX),
    name_en: t.title.trim(),
    has_pt: ptName !== null,
    muscle_group: primary,
    secondary_muscles: secondary,
    exercise_type: toExerciseType(t.type),
    equipment: t.equipment ? (EQUIPMENT_PT[t.equipment] ?? t.equipment) : null,
    thumbnail_url: https(t.thumbnail_url),
    media_url: custom ? null : https(pt?.media_url),
    instructions: clean(instructions),
    source: custom ? "hevy_custom" : "hevy",
  };
}

// ── Treinos ──────────────────────────────────────────────────────────────

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
const positive = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null);

function toSet(s: HevySet, position: number): ImportedSet | null {
  const weight = typeof s.weight_kg === "number" && Number.isFinite(s.weight_kg) && s.weight_kg >= 0 ? round(s.weight_kg, 2) : null;
  const reps = positive(s.reps);
  const distance = positive(s.distance_meters);
  const duration = positive(s.duration_seconds);
  const set: ImportedSet = {
    position,
    set_type: toSetType(s.type),
    weight_kg: weight,
    reps: reps === null ? null : Math.round(reps),
    distance_m: distance === null ? null : round(distance, 1),
    duration_s: duration === null ? null : Math.round(duration),
    pr_kinds: [],
  };
  const hasMetric = [set.weight_kg, set.reps, set.distance_m, set.duration_s].some((v) => v !== null);
  return hasMetric ? set : null;
}

/**
 * Um treino do Hevy em linhas do Bctrl Hub. `known` diz quais modelos existem no catálogo
 * importado: exercício de modelo desconhecido é ignorado (com motivo), assim como série
 * sem nenhuma métrica. Treino que fica sem exercício vira `null`.
 */
export function workoutToRows(
  w: HevyWorkout,
  known: ReadonlyMap<string, ExerciseType>,
): { workout: ImportedWorkout | null; skipped: Skipped[] } {
  const skipped: Skipped[] = [];
  const day = dayInSaoPaulo(w.start_time);
  const label = `${day} · ${clean(w.title) ?? "sem título"}`;
  const started = new Date(w.start_time);
  const ended = w.end_time ? new Date(w.end_time) : started;

  const exercises: ImportedExercise[] = [];
  for (const e of [...w.exercises].sort((a, b) => a.index - b.index)) {
    const ref = `${label} → ${e.title}`;
    if (!known.has(e.exercise_template_id)) {
      skipped.push({ kind: "exercício", ref, reason: `modelo ${e.exercise_template_id} não está no catálogo da API` });
      continue;
    }
    const sets: ImportedSet[] = [];
    for (const s of [...e.sets].sort((a, b) => a.index - b.index)) {
      const set = toSet(s, sets.length + 1);
      if (set) sets.push(set);
      else skipped.push({ kind: "série", ref: `${ref} · série ${s.index + 1}`, reason: "série sem nenhuma métrica (carga, reps, distância ou duração)" });
    }
    if (sets.length === 0) {
      skipped.push({ kind: "exercício", ref, reason: "nenhuma série com métrica" });
      continue;
    }
    exercises.push({ position: exercises.length + 1, hevy_template_id: e.exercise_template_id, notes: clean(e.notes), sets });
  }

  if (exercises.length === 0) {
    skipped.push({ kind: "treino", ref: `${label} (${w.id})`, reason: "nenhum exercício importável" });
    return { workout: null, skipped };
  }

  const title = clean(w.title);
  const description = clean(w.description);
  return {
    workout: {
      hevy_workout_id: w.id,
      started_at: started.toISOString(),
      finished_at: (ended < started ? started : ended).toISOString(),
      day,
      notes: [title, description].filter(Boolean).join("\n\n") || null,
      exercises,
    },
    skipped,
  };
}

const chronological = (a: ImportedWorkout, b: ImportedWorkout) =>
  a.started_at.localeCompare(b.started_at) || a.hevy_workout_id.localeCompare(b.hevy_workout_id);

const toEntry = (s: ImportedSet): SetEntry => ({
  done: true,
  setType: s.set_type,
  weightKg: s.weight_kg,
  reps: s.reps,
  distanceM: s.distance_m,
  durationS: s.duration_s,
});

/**
 * Recordes (pr_kinds) do histórico importado, em ordem cronológica e com as mesmas regras
 * do app (src/lib/domain/workout.ts): aquecimento fora, empate não é PR, a primeira sessão
 * de cada exercício só estabelece a referência. Devolve os treinos ordenados.
 */
export function assignPrs(workouts: readonly ImportedWorkout[], types: ReadonlyMap<string, ExerciseType>): ImportedWorkout[] {
  const bests = new Map<string, Bests | null>();
  return [...workouts].sort(chronological).map((w) => ({
    ...w,
    exercises: w.exercises.map((e) => {
      const type = types.get(e.hevy_template_id) ?? "weight_reps";
      const entries = e.sets.map(toEntry);
      const current = bests.get(e.hevy_template_id) ?? null;
      const prs = markSessionPrs(entries, current, type);
      bests.set(
        e.hevy_template_id,
        entries.reduce<Bests | null>((acc, s) => (isCountable(s, type) ? mergeBests(acc, s) : acc), current),
      );
      return { ...e, sets: e.sets.map((s, i) => ({ ...s, pr_kinds: prs[i] })) };
    }),
  }));
}

// ── Vínculo com os exercícios atuais ─────────────────────────────────────

export type LinkMethod = "exato" | "normalizado" | "override";
export type Link = { existingName: string; hevyTemplateId: string; catalogName: string; method: LinkMethod };
export type Pending = { existingName: string; reason: string; suggestions: { hevyTemplateId: string; name: string }[] };
/** `overrides.json`: nome no app → id do modelo no Hevy, ou `null` para manter sem vínculo. */
export type Overrides = Record<string, string | null>;
export type LinkResult = {
  links: Link[];
  pending: Pending[];
  kept: { existingName: string; reason: string }[];
  errors: string[];
};

const tokens = (name: string) => [...new Set(normalizeName(name).split(" ").filter((t) => t.length > 2))];
/** Mesma palavra ou variação (prefixo de 4+ letras: "halter" ~ "halteres"). */
const sameWord = (a: string, b: string) =>
  a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Uso de cada modelo no histórico (número de treinos), para desempatar sugestões. */
export type Usage = ReadonlyMap<string, number>;

/** Até 3 sugestões por palavras em comum, desempatando pelo uso no histórico. */
function suggest(name: string, catalog: readonly ExerciseRow[], usage: Usage) {
  const mine = tokens(name);
  return catalog
    .map((c) => {
      const theirs = [...tokens(c.name), ...tokens(c.name_en)];
      return { c, score: mine.filter((t) => theirs.some((o) => sameWord(t, o))).length };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (usage.get(b.c.hevy_template_id) ?? 0) - (usage.get(a.c.hevy_template_id) ?? 0) ||
        byText(a.c.name, b.c.name),
    )
    .slice(0, 3)
    .map(({ c }) => ({ hevyTemplateId: c.hevy_template_id, name: c.name }));
}

/**
 * Liga os exercícios que o dono já tem no app aos modelos do catálogo. O override
 * (decisão explícita do dono) vale primeiro; depois nome exato (PT ou inglês), depois
 * normalizado. Ambíguo, sem equivalente ou modelo já usado ficam pendentes.
 */
export function linkExisting(
  existing: readonly ExistingExercise[],
  catalog: readonly ExerciseRow[],
  overrides: Overrides,
  usage: Usage = new Map(),
): LinkResult {
  const byId = new Map(catalog.map((c) => [c.hevy_template_id, c]));
  const names = new Set(existing.map((e) => e.name));
  const result: LinkResult = { links: [], pending: [], kept: [], errors: [] };
  const used = new Set<string>();
  const linked = new Set<string>();

  for (const [name, id] of Object.entries(overrides)) {
    if (!names.has(name)) result.errors.push(`overrides.json: "${name}" não existe entre os exercícios do app.`);
    else if (id !== null && !byId.has(id)) result.errors.push(`overrides.json: "${name}" aponta para ${id}, que não está no catálogo.`);
  }

  const link = (e: ExistingExercise, c: ExerciseRow, method: LinkMethod) => {
    if (used.has(c.hevy_template_id)) {
      const owner = result.links.find((l) => l.hevyTemplateId === c.hevy_template_id)?.existingName;
      result.pending.push({ existingName: e.name, reason: `modelo ${c.hevy_template_id} (${c.name}) já vinculado a "${owner}"`, suggestions: [] });
    } else {
      used.add(c.hevy_template_id);
      result.links.push({ existingName: e.name, hevyTemplateId: c.hevy_template_id, catalogName: c.name, method });
    }
    linked.add(e.name);
  };

  // 1) overrides
  for (const e of existing) {
    if (!(e.name in overrides)) continue;
    const id = overrides[e.name];
    if (id === null) {
      result.kept.push({ existingName: e.name, reason: "mantido sem vínculo (overrides.json)" });
      linked.add(e.name);
    } else if (byId.has(id)) link(e, byId.get(id)!, "override");
    else linked.add(e.name); // erro já registrado
  }
  // 2) exato (PT ou inglês)
  for (const e of existing) {
    if (linked.has(e.name)) continue;
    const exact = catalog.filter((c) => c.name === e.name || c.name_en === e.name);
    if (exact.length === 1) link(e, exact[0], "exato");
  }
  // 3) normalizado
  for (const e of existing) {
    if (linked.has(e.name)) continue;
    const key = normalizeName(e.name);
    const matches = catalog.filter((c) => normalizeName(c.name) === key || normalizeName(c.name_en) === key);
    if (matches.length === 1) link(e, matches[0], "normalizado");
    else if (matches.length > 1) {
      result.pending.push({
        existingName: e.name,
        reason: `nome ambíguo: ${matches.length} modelos com o mesmo nome`,
        suggestions: matches.map((c) => ({ hevyTemplateId: c.hevy_template_id, name: `${c.name} — ${c.name_en}` })),
      });
      linked.add(e.name);
    } else {
      result.pending.push({ existingName: e.name, reason: "sem equivalente por nome", suggestions: suggest(e.name, catalog, usage) });
      linked.add(e.name);
    }
  }

  result.links.sort((a, b) => byText(a.existingName, b.existingName));
  result.pending.sort((a, b) => byText(a.existingName, b.existingName));
  result.kept.sort((a, b) => byText(a.existingName, b.existingName));
  return result;
}

/**
 * Nome final de cada linha do catálogo. Vinculado herda o nome do app; nome repetido
 * (no catálogo ou com um exercício do app) ganha o nome em inglês entre parênteses.
 * `exercises` tem `unique (user_id, name)`, então nenhum nome pode se repetir.
 */
export function resolveCatalogNames(
  catalog: readonly ExerciseRow[],
  existing: readonly ExistingExercise[],
  links: readonly Link[],
): { rows: ExerciseRow[]; renamed: { hevyTemplateId: string; from: string; to: string }[] } {
  const linkedName = new Map(links.map((l) => [l.hevyTemplateId, l.existingName]));
  const taken = new Set(existing.map((e) => e.name.toLowerCase()));
  const renamed: { hevyTemplateId: string; from: string; to: string }[] = [];
  const sorted = [...catalog].sort((a, b) => a.hevy_template_id.localeCompare(b.hevy_template_id));

  const rows = sorted.map((row) => {
    const own = linkedName.get(row.hevy_template_id);
    if (own) return { ...row, name: own };
    let name = row.name;
    if (taken.has(name.toLowerCase())) {
      const alt = row.name_en !== row.name ? row.name_en : row.hevy_template_id;
      name = `${row.name} (${alt})`.slice(0, NAME_MAX);
      for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${row.name} (${alt}) ${n}`.slice(0, NAME_MAX);
      renamed.push({ hevyTemplateId: row.hevy_template_id, from: row.name, to: name });
    }
    taken.add(name.toLowerCase());
    return { ...row, name };
  });
  return { rows, renamed };
}

// ── Seed privado (fonte dos exercícios atuais no dry-run) ────────────────

const SQL_STR = "'((?:[^']|'')*)'";
const unquote = (s: string) => s.replace(/''/g, "'");

/** Exercícios do `insert into public.exercises` do seed (formato de supabase/seed.example.sql). */
export function parseSeedExercises(sql: string): ExistingExercise[] {
  const re = new RegExp(`\\(md5\\(v_uid::text \\|\\| ':exercise:' \\|\\| ${SQL_STR}\\)::uuid,\\s*v_uid,\\s*${SQL_STR},\\s*(?:${SQL_STR}|null)\\)`, "g");
  return [...sql.matchAll(re)].map((m) => ({ name: unquote(m[2]), muscle_group: m[3] === undefined ? null : unquote(m[3]) }));
}

export function parseSeedOwnerEmail(sql: string): string | null {
  const m = sql.match(new RegExp(`from auth\\.users where email = ${SQL_STR}`));
  return m ? unquote(m[1]) : null;
}

// ── Plano ────────────────────────────────────────────────────────────────

export type ImportInput = {
  templates: readonly HevyTemplate[];
  workouts: readonly HevyWorkout[];
  pt: PtCatalog;
  existing: readonly ExistingExercise[];
  overrides: Overrides;
  instructions?: Record<string, string>;
};

export type ImportPlan = {
  catalog: ExerciseRow[];
  /** Treinos do Hevy em que cada modelo aparece. */
  usage: Map<string, number>;
  renamed: { hevyTemplateId: string; from: string; to: string }[];
  links: LinkResult;
  workouts: ImportedWorkout[];
  skipped: Skipped[];
  stats: {
    templates: number;
    customTemplates: number;
    withoutPt: number;
    withMedia: number;
    workoutsFromApi: number;
    workoutsImported: number;
    exercisesImported: number;
    setsImported: number;
    warmupSets: number;
    setsByType: Record<SetType, number>;
    prs: number;
    rpeIgnored: number;
    firstDay: string | null;
    lastDay: string | null;
  };
};

export function planImport(input: ImportInput): ImportPlan {
  const templates = [...input.templates].sort((a, b) => a.id.localeCompare(b.id));
  const raw = templates.map((t) => templateToExercise(t, input.pt[t.id], input.instructions?.[t.id]));
  const usage = new Map<string, number>();
  for (const w of input.workouts) {
    for (const id of new Set(w.exercises.map((e) => e.exercise_template_id))) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  const links = linkExisting(input.existing, raw, input.overrides, usage);
  const { rows: catalog, renamed } = resolveCatalogNames(raw, input.existing, links.links);
  const types = new Map(catalog.map((c) => [c.hevy_template_id, c.exercise_type]));

  const sortedApi = [...input.workouts].sort(
    (a, b) => a.start_time.localeCompare(b.start_time) || a.id.localeCompare(b.id),
  );
  const skipped: Skipped[] = [];
  const imported: ImportedWorkout[] = [];
  for (const w of sortedApi) {
    const result = workoutToRows(w, types);
    skipped.push(...result.skipped);
    if (result.workout) imported.push(result.workout);
  }
  const workouts = assignPrs(imported, types);

  const sets = workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets));
  const setsByType: Record<SetType, number> = { normal: 0, warmup: 0, failure: 0, dropset: 0 };
  for (const s of sets) setsByType[s.set_type] += 1;
  const importedIds = new Set(workouts.map((w) => w.hevy_workout_id));
  const rpeIgnored = sortedApi
    .filter((w) => importedIds.has(w.id))
    .flatMap((w) => w.exercises.flatMap((e) => e.sets))
    .filter((s) => s.rpe !== null && s.rpe !== undefined).length;

  return {
    catalog,
    usage,
    renamed,
    links,
    workouts,
    skipped,
    stats: {
      templates: catalog.length,
      customTemplates: catalog.filter((c) => c.source === "hevy_custom").length,
      withoutPt: catalog.filter((c) => !c.has_pt).length,
      withMedia: catalog.filter((c) => c.media_url).length,
      workoutsFromApi: input.workouts.length,
      workoutsImported: workouts.length,
      exercisesImported: workouts.reduce((n, w) => n + w.exercises.length, 0),
      setsImported: sets.length,
      warmupSets: setsByType.warmup,
      setsByType,
      prs: sets.reduce((n, s) => n + s.pr_kinds.length, 0),
      rpeIgnored,
      firstDay: workouts[0]?.day ?? null,
      lastDay: workouts.at(-1)?.day ?? null,
    },
  };
}

// ── SQL ──────────────────────────────────────────────────────────────────

const q = (value: string | null) => (value === null ? "null" : `'${value.replace(/'/g, "''")}'`);
const num = (value: number | null, cast: string) => (value === null ? `null::${cast}` : `${value}::${cast}`);
const textArray = (values: readonly string[]) =>
  values.length === 0 ? "'{}'::text[]" : `array[${values.map((v) => q(v)).join(", ")}]::text[]`;
const EMAIL_RE = /^[^\s'"\\;]+@[^\s'"\\;]+\.[^\s'"\\;]+$/;

/**
 * SQL privado (`supabase/import.private.sql`), num único bloco transacional. O dono é
 * resolvido por e-mail, como no seed privado. Mesmo plano → mesmo texto.
 */
export function buildImportSql({ ownerEmail, plan }: { ownerEmail: string; plan: ImportPlan }): string {
  if (!EMAIL_RE.test(ownerEmail)) throw new Error("E-mail do dono inválido.");
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    "-- Importação do Hevy (gerado por scripts/hevy/run.ts --write). DADOS PESSOAIS: não versionar.",
    "-- Idempotente: rodar de novo não duplica exercícios, treinos nem séries.",
    "-- Aplicar: npx supabase db query --linked -f supabase/import.private.sql",
    `-- ${plan.catalog.length} exercícios do catálogo, ${plan.links.links.length} vínculos, ${plan.workouts.length} treinos, ${plan.stats.setsImported} séries.`,
    "",
    "do $import$",
    "declare",
    `  v_uid uuid := (select id from auth.users where email = ${q(ownerEmail)});`,
    "  v_existing uuid;",
    "  v_dup uuid;",
    "  v_workout uuid;",
    "begin",
    "  if v_uid is null then",
    "    raise exception 'Usuário dono não encontrado em auth.users.';",
    "  end if;",
    "",
    "  -- 1) Vínculos: os exercícios atuais passam a apontar para o modelo do Hevy (mesmo id).",
  );

  for (const l of plan.links.links) {
    push(
      `  -- ${l.method}: ${l.existingName} ↔ ${l.hevyTemplateId} (${l.catalogName})`,
      `  select id into v_existing from public.exercises where user_id = v_uid and name = ${q(l.existingName)};`,
      "  if v_existing is null then",
      `    raise exception 'Exercício % não existe mais: gere o SQL de novo.', ${q(l.existingName)};`,
      "  end if;",
      // Linha criada antes para o mesmo modelo (ex.: vínculo decidido depois): migra o histórico e some.
      `  for v_dup in select id from public.exercises where user_id = v_uid and hevy_template_id = ${q(l.hevyTemplateId)} and id <> v_existing loop`,
      "    update public.workout_exercises set exercise_id = v_existing where user_id = v_uid and exercise_id = v_dup;",
      "    update public.routine_exercises set exercise_id = v_existing where user_id = v_uid and exercise_id = v_dup;",
      "    delete from public.exercises where id = v_dup;",
      "  end loop;",
      `  update public.exercises set hevy_template_id = ${q(l.hevyTemplateId)} where id = v_existing;`,
    );
  }

  push(
    "",
    "  -- 2) Catálogo (e personalizados). Nome do vinculado não muda; instruções próprias não são apagadas.",
    "  insert into public.exercises (",
    "    id, user_id, name, muscle_group, hevy_template_id, exercise_type, equipment,",
    "    secondary_muscles, thumbnail_url, media_url, instructions, source",
    "  ) values",
  );
  plan.catalog.forEach((c, i) => {
    const sep = i === plan.catalog.length - 1 ? "" : ",";
    push(
      `    (md5(v_uid::text || ':hevy-template:' || ${q(c.hevy_template_id)})::uuid, v_uid, ${q(c.name)}, ${q(c.muscle_group)}, ` +
        `${q(c.hevy_template_id)}, ${q(c.exercise_type)}, ${q(c.equipment)}, ${textArray(c.secondary_muscles)}, ` +
        `${q(c.thumbnail_url)}, ${q(c.media_url)}, ${q(c.instructions)}, ${q(c.source)})${sep}`,
    );
  });
  push(
    "  on conflict (user_id, hevy_template_id) do update set",
    "    muscle_group = excluded.muscle_group,",
    "    exercise_type = excluded.exercise_type,",
    "    equipment = excluded.equipment,",
    "    secondary_muscles = excluded.secondary_muscles,",
    "    thumbnail_url = excluded.thumbnail_url,",
    "    media_url = excluded.media_url,",
    "    instructions = coalesce(excluded.instructions, public.exercises.instructions),",
    "    source = excluded.source;",
    "",
    "  -- 3) Treinos: upsert por hevy_workout_id; exercícios e séries regravados com ids fixos.",
  );

  for (const w of plan.workouts) {
    const wid = w.hevy_workout_id;
    push(
      "",
      `  -- ${w.day} · ${wid}`,
      "  insert into public.workouts (id, user_id, routine_id, started_at, finished_at, day, notes, hevy_workout_id, source)",
      `  values (md5(v_uid::text || ':hevy-workout:' || ${q(wid)})::uuid, v_uid, null, ${q(w.started_at)}::timestamptz, ` +
        `${q(w.finished_at)}::timestamptz, ${q(w.day)}::date, ${q(w.notes)}, ${q(wid)}, 'hevy')`,
      "  on conflict (user_id, hevy_workout_id) do update set",
      "    started_at = excluded.started_at, finished_at = excluded.finished_at, day = excluded.day, notes = excluded.notes",
      "  returning id into v_workout;",
      "  delete from public.workout_exercises where user_id = v_uid and workout_id = v_workout;",
      "  insert into public.workout_exercises (id, user_id, workout_id, exercise_id, position, notes)",
      "  select md5(v_uid::text || v.k)::uuid, v_uid, v_workout,",
      "    (select e.id from public.exercises e where e.user_id = v_uid and e.hevy_template_id = v.tid), v.pos, v.notes",
      "  from (values",
    );
    w.exercises.forEach((e, i) => {
      const sep = i === w.exercises.length - 1 ? "" : ",";
      push(`    (${q(`:hevy-we:${wid}:${e.position}`)}, ${q(e.hevy_template_id)}, ${e.position}, ${q(e.notes)}::text)${sep}`);
    });
    push(
      "  ) v(k, tid, pos, notes);",
      "  insert into public.workout_sets (id, user_id, workout_exercise_id, position, set_type, weight_kg, reps, distance_m, duration_s, pr_kinds)",
      "  select md5(v_uid::text || v.k)::uuid, v_uid, md5(v_uid::text || v.we)::uuid, v.pos, v.st, v.w, v.r, v.d, v.s, v.pr",
      "  from (values",
    );
    const sets = w.exercises.flatMap((e) => e.sets.map((s) => ({ e, s })));
    sets.forEach(({ e, s }, i) => {
      const sep = i === sets.length - 1 ? "" : ",";
      push(
        `    (${q(`:hevy-ws:${wid}:${e.position}:${s.position}`)}, ${q(`:hevy-we:${wid}:${e.position}`)}, ${s.position}, ${q(s.set_type)}, ` +
          `${num(s.weight_kg, "numeric")}, ${num(s.reps, "int")}, ${num(s.distance_m, "numeric")}, ${num(s.duration_s, "int")}, ` +
          `${textArray(s.pr_kinds)})${sep}`,
      );
    });
    push("  ) v(k, we, pos, st, w, r, d, s, pr);");
  }

  push("end", "$import$;", "");
  return out.join("\n");
}
