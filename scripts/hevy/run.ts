/**
 * Importação única do Hevy para o Bctrl Hub.
 *
 *   npm run import:hevy                 # dry-run (padrão): só gera scripts/hevy/out/report.md
 *   npm run import:hevy -- --write      # também gera supabase/import.private.sql
 *
 * Opções:
 *   --existing <arquivo>  exercícios atuais do app: seed .sql (padrão supabase/seed.private.sql) ou .json
 *                         ([{ "name": "...", "muscle_group": "..." }])
 *   --email <e-mail>      dono no banco (padrão: HEVY_OWNER_EMAIL ou o e-mail do seed privado)
 *
 * Entradas locais (fora do Git): .env.local (HEVY_API_KEY), scripts/hevy/data/catalog-pt.json
 * (obrigatório), scripts/hevy/data/overrides.json (opcional), scripts/hevy/instructions/*.json (opcional).
 * Aplicar no remoto só depois da revisão: npx supabase db query --linked -f supabase/import.private.sql
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createHevyClient, readApiKey } from "./api";
import {
  buildImportSql,
  parseSeedExercises,
  parseSeedOwnerEmail,
  planImport,
  type ExistingExercise,
  type Overrides,
  type PtCatalog,
} from "./map";
import { renderReport } from "./report";

const ROOT = process.cwd();
const path = (...parts: string[]) => resolve(ROOT, ...parts);
const DATA = path("scripts/hevy/data");
const OUT = path("scripts/hevy/out");
const SQL_OUT = path("supabase/import.private.sql");

function parseArgs(argv: string[]) {
  const args = { write: false, existing: "supabase/seed.private.sql", email: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") args.write = true;
    else if (a === "--dry-run") args.write = false;
    else if (a === "--existing") args.existing = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  return args;
}

const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;

function readExisting(file: string): ExistingExercise[] {
  if (!existsSync(file)) throw new Error(`Exercícios atuais não encontrados em ${relative(ROOT, file)} (use --existing).`);
  if (file.endsWith(".json")) return readJson<ExistingExercise[]>(file);
  const rows = parseSeedExercises(readFileSync(file, "utf8"));
  if (rows.length === 0) throw new Error(`Nenhum exercício reconhecido em ${relative(ROOT, file)}.`);
  return rows;
}

function readInstructions(): Record<string, string> {
  const dir = path("scripts/hevy/instructions");
  if (!existsSync(dir)) return {};
  return Object.assign({}, ...readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => readJson<Record<string, string>>(join(dir, f))));
}

function validatePt(pt: PtCatalog) {
  const entries = Object.entries(pt);
  const bad = entries.filter(([id, v]) => !/^[0-9A-F]{8}$/.test(id) || typeof v !== "object" || v === null || !("pt_br_title" in v) || !("media_url" in v));
  if (entries.length === 0 || bad.length) throw new Error(`catalog-pt.json com estrutura inesperada (${bad.length} entradas inválidas).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (existsSync(path(".env.local"))) process.loadEnvFile(path(".env.local"));
  const apiKey = readApiKey(process.env);

  const ptFile = join(DATA, "catalog-pt.json");
  if (!existsSync(ptFile)) throw new Error("Falta scripts/hevy/data/catalog-pt.json (extraído do hevy.com pelo Chrome).");
  const pt = readJson<PtCatalog>(ptFile);
  validatePt(pt);
  const overridesFile = join(DATA, "overrides.json");
  const overrides = existsSync(overridesFile) ? readJson<Overrides>(overridesFile) : {};
  const existingFile = path(args.existing);
  const existing = readExisting(existingFile);

  const client = createHevyClient({ apiKey });
  console.log("Lendo a API do Hevy…");
  const [templates, workouts, apiWorkoutCount] = await Promise.all([
    client.listExerciseTemplates(),
    client.listWorkouts(),
    client.workoutCount(),
  ]);
  console.log(`${templates.length} modelos, ${workouts.length} treinos (contagem da API: ${apiWorkoutCount}).`);

  const plan = planImport({ templates, workouts, pt, existing, overrides, instructions: readInstructions() });

  let sqlPath: string | undefined;
  if (args.write) {
    if (plan.links.errors.length) throw new Error(`Corrija overrides.json antes do --write:\n- ${plan.links.errors.join("\n- ")}`);
    const seedEmail = existsSync(path("supabase/seed.private.sql"))
      ? parseSeedOwnerEmail(readFileSync(path("supabase/seed.private.sql"), "utf8"))
      : null;
    const email = args.email ?? process.env.HEVY_OWNER_EMAIL ?? seedEmail;
    if (!email) throw new Error("E-mail do dono não encontrado: use --email ou HEVY_OWNER_EMAIL.");
    writeFileSync(SQL_OUT, buildImportSql({ ownerEmail: email, plan }));
    sqlPath = relative(ROOT, SQL_OUT).replace(/\\/g, "/");
  }

  mkdirSync(OUT, { recursive: true });
  const report = renderReport(plan, {
    generatedAt: new Date().toISOString(),
    mode: args.write ? "write" : "dry-run",
    existingSource: relative(ROOT, existingFile).replace(/\\/g, "/"),
    existingCount: existing.length,
    apiWorkoutCount,
    sqlPath,
  });
  writeFileSync(join(OUT, "report.md"), report);

  const { stats, links } = plan;
  console.log(
    [
      `Catálogo: ${stats.templates} (${stats.customTemplates} personalizados, ${stats.withoutPt} sem PT).`,
      `Vínculos: ${links.links.length} · pendentes: ${links.pending.length} · erros de override: ${links.errors.length}.`,
      `Treinos: ${stats.workoutsImported}/${apiWorkoutCount} · séries: ${stats.setsImported} · PRs: ${stats.prs} · ignorados: ${plan.skipped.length}.`,
      `Relatório: scripts/hevy/out/report.md${sqlPath ? ` · SQL: ${sqlPath}` : ""}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(`Importação interrompida: ${(error as Error).message}`);
  process.exitCode = 1;
});
