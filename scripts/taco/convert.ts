/**
 * Converte o TACO.json (marcelosanto/tabela_taco, MIT) na migration da tabela `foods`.
 *
 *   npm run taco:convert                       # baixa o JSON da fonte
 *   npm run taco:convert -- --input TACO.json  # usa um arquivo já baixado
 *
 * Saída: supabase/migrations/20261019230000_foods_taco.sql (dado público, versionado).
 * Aplicar: npx supabase db push (remoto) · npx supabase migration up (local).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { buildTacoMigration, TACO_SOURCE_URL, tacoToFoods } from "./taco";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "supabase/migrations/20261019230000_foods_taco.sql");
const EXPECTED = 597;

function parseArgs(argv: string[]) {
  const args = { input: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input") args.input = argv[++i];
    else throw new Error(`Opção desconhecida: ${argv[i]}`);
  }
  return args;
}

async function readTaco(input: string | undefined): Promise<unknown> {
  if (input) return JSON.parse(readFileSync(resolve(ROOT, input), "utf8"));
  const res = await fetch(TACO_SOURCE_URL);
  if (!res.ok) throw new Error(`Falha ao baixar a TACO: HTTP ${res.status}.`);
  return res.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const foods = tacoToFoods(await readTaco(args.input));
  if (foods.length !== EXPECTED) throw new Error(`Esperava ${EXPECTED} alimentos, vieram ${foods.length}.`);
  writeFileSync(OUT, buildTacoMigration(foods));
  const zeros = foods.filter((f) => f.kcal === 0).length;
  console.log(`${foods.length} alimentos → ${relative(ROOT, OUT)} (${zeros} sem kcal na TACO).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
