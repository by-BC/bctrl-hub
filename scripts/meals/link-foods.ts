/**
 * Auto-vínculo dos itens do plano alimentar do dono com a TACO (task 4.0 v2).
 *
 *   npm run meals:link                 # dry-run (padrão): só gera scripts/meals/out/report.md
 *   npm run meals:link -- --write      # também gera supabase/meal-items.private.sql
 *
 * Opções:
 *   --plan <arquivo>   plano atual: seed .sql (padrão supabase/seed.private.sql) ou .json
 *                      ([{ "meal", "position", "title", "items": [{ "name", "qty" }] }])
 *   --email <e-mail>   dono no banco (padrão: MEALS_OWNER_EMAIL ou o e-mail do seed)
 *
 * Entradas locais (fora do Git): o seed privado, scripts/meals/data/overrides.json (opcional;
 * `{ "nome do item": idTaco | "free" | "pending" | "own:<chave>" }`) e
 * scripts/meals/data/own-foods.json (opcional; alimentos próprios do dono, por 100 g:
 * `[{ "key", "name", "kcal", "protein_g", "carbs_g", "fat_g", "note"?, "check"? }]`).
 * A TACO vem da migration versionada (supabase/migrations/*_foods_taco.sql).
 * Aplicar no remoto só depois da revisão: npx supabase db query --linked -f supabase/meal-items.private.sql
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseTacoMigration } from "../taco/taco";
import {
  buildLinkSql,
  parseSeedMealOptions,
  parseSeedOwnerEmail,
  planLinks,
  type OwnFood,
  type Overrides,
  type SeedOption,
} from "./link";
import { renderLinkReport } from "./report";

const ROOT = process.cwd();
const path = (...parts: string[]) => resolve(ROOT, ...parts);
const OUT = path("scripts/meals/out");
const SQL_OUT = path("supabase/meal-items.private.sql");
const OVERRIDES = path("scripts/meals/data/overrides.json");
const OWN_FOODS = path("scripts/meals/data/own-foods.json");

function parseArgs(argv: string[]) {
  const args = { write: false, plan: "supabase/seed.private.sql", email: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") args.write = true;
    else if (a === "--dry-run") args.write = false;
    else if (a === "--plan") args.plan = argv[++i];
    else if (a === "--email") args.email = argv[++i];
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  return args;
}

function readTaco() {
  const dir = path("supabase/migrations");
  const file = readdirSync(dir).find((f) => f.endsWith("_foods_taco.sql"));
  if (!file) throw new Error("Migration da TACO não encontrada (rode npm run taco:convert).");
  const taco = parseTacoMigration(readFileSync(resolve(dir, file), "utf8"));
  if (taco.length !== 597) throw new Error(`Esperava 597 alimentos na migration, li ${taco.length}.`);
  return taco;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const planFile = path(args.plan);
  if (!existsSync(planFile)) throw new Error(`Plano não encontrado em ${relative(ROOT, planFile)} (use --plan).`);
  const text = readFileSync(planFile, "utf8");
  const options: SeedOption[] = planFile.endsWith(".json") ? JSON.parse(text) : parseSeedMealOptions(text);
  if (options.length === 0) throw new Error(`Nenhuma opção de refeição reconhecida em ${relative(ROOT, planFile)}.`);

  const overrides: Overrides = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
  const ownFoods: OwnFood[] = existsSync(OWN_FOODS) ? JSON.parse(readFileSync(OWN_FOODS, "utf8")) : [];
  const plan = planLinks(options, readTaco(), overrides, ownFoods);

  let sqlPath: string | undefined;
  if (args.write) {
    const email = args.email ?? process.env.MEALS_OWNER_EMAIL ?? (planFile.endsWith(".sql") ? parseSeedOwnerEmail(text) : null);
    if (!email) throw new Error("E-mail do dono não encontrado (use --email).");
    writeFileSync(SQL_OUT, buildLinkSql({ ownerEmail: email, plan }));
    sqlPath = relative(ROOT, SQL_OUT).replace(/\\/g, "/");
  }

  mkdirSync(OUT, { recursive: true });
  const report = resolve(OUT, "report.md");
  writeFileSync(
    report,
    renderLinkReport(plan, { generatedAt: new Date().toISOString(), source: relative(ROOT, planFile).replace(/\\/g, "/"), sqlPath }),
  );

  const count = (s: string) => plan.unique.filter((l) => l.status === s).length;
  console.log(
    `${plan.options.length} opções, ${plan.unique.length} itens distintos: ${count("auto")} automáticos, ` +
      `${count("free")} livres, ${count("pending")} pendentes; ${ownFoods.length} alimentos próprios.`,
  );
  console.log(`Relatório: ${relative(ROOT, report)}${sqlPath ? ` · SQL: ${sqlPath}` : " (dry-run, sem SQL)"}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
