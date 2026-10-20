/**
 * Gera o SQL privado das instruções próprias dos exercícios.
 *
 *   npm run instructions:hevy                       # valida e gera supabase/instructions.private.sql
 *   npm run instructions:hevy -- --check            # só valida e mostra a cobertura
 *   npm run instructions:hevy -- --email <e-mail> --out <arquivo>
 *
 * Entradas: scripts/hevy/instructions/*.json (fora do Git) e, para a cobertura,
 * supabase/import.private.sql (ids do catálogo do dono).
 * Aplicar no remoto (o dono roda): npx supabase db query --linked -f supabase/instructions.private.sql
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseSeedOwnerEmail } from "./map";
import { buildInstructionsSql, coverage, mergeInstructions, parseCatalogIds } from "./instructions";

const ROOT = process.cwd();
const path = (...parts: string[]) => resolve(ROOT, ...parts);
const DIR = path("scripts/hevy/instructions");

function parseArgs(argv: string[]) {
  const args = { check: false, email: undefined as string | undefined, out: "supabase/instructions.private.sql" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--check") args.check = true;
    else if (a === "--email") args.email = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else throw new Error(`Opção desconhecida: ${a}`);
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(DIR)) throw new Error("Falta a pasta scripts/hevy/instructions/.");
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((name) => ({ name, data: JSON.parse(readFileSync(join(DIR, name), "utf8")) as unknown }));
  const { instructions, errors } = mergeInstructions(files);
  if (errors.length) throw new Error(`Corrija as instruções:\n- ${errors.join("\n- ")}`);
  console.log(`${Object.keys(instructions).length} instruções em ${files.length} arquivo(s).`);

  const importSql = path("supabase/import.private.sql");
  if (existsSync(importSql)) {
    const { covered, missing, unknown } = coverage(instructions, parseCatalogIds(readFileSync(importSql, "utf8")));
    console.log(`Cobertura do catálogo: ${covered}/${covered + missing.length}.`);
    if (missing.length) console.log(`Sem instrução: ${missing.join(", ")}`);
    if (unknown.length) console.log(`Ids fora do catálogo (ignorados no banco): ${unknown.join(", ")}`);
  }
  if (args.check) return;

  const seed = path("supabase/seed.private.sql");
  const email =
    args.email ?? process.env.HEVY_OWNER_EMAIL ?? (existsSync(seed) ? parseSeedOwnerEmail(readFileSync(seed, "utf8")) : null);
  if (!email) throw new Error("E-mail do dono não encontrado: use --email ou HEVY_OWNER_EMAIL.");
  const out = path(args.out);
  writeFileSync(out, buildInstructionsSql({ ownerEmail: email, instructions }));
  console.log(`SQL: ${relative(ROOT, out).replace(/\\/g, "/")}`);
}

try {
  main();
} catch (error) {
  console.error(`Instruções: ${(error as Error).message}`);
  process.exitCode = 1;
}
