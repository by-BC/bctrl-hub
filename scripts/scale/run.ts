/**
 * Importação única da planilha da balança (task 2.0 v3).
 *
 *   npm run import:scale -- <arquivo.xlsx>            # dry-run (padrão): só gera scripts/scale/out/report.md
 *   npm run import:scale -- <arquivo.xlsx> --write    # também gera supabase/scale.private.sql
 *
 * Opções:
 *   --email <e-mail>  dono no banco (padrão: o e-mail do seed privado, supabase/seed.private.sql)
 *
 * A planilha fica fora do repositório; o relatório e o SQL são ignorados pelo Git.
 * Aplicar no remoto só depois da revisão (pelo dono): npx supabase db query --linked -f supabase/scale.private.sql
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { parseSeedOwnerEmail } from "../hevy/map";
import { parseScaleSheet, readSheetRows, toSql } from "./parse";
import { renderReport } from "./report";

const ROOT = process.cwd();
const OUT = resolve(ROOT, "scripts/scale/out");
const SQL_OUT = resolve(ROOT, "supabase/scale.private.sql");
const SEED = resolve(ROOT, "supabase/seed.private.sql");

function parseArgs(argv: string[]) {
  const args = { file: undefined as string | undefined, write: false, email: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--write") args.write = true;
    else if (a === "--dry-run") args.write = false;
    else if (a === "--email") args.email = argv[++i];
    else if (a.startsWith("--")) throw new Error(`Opção desconhecida: ${a}`);
    else if (args.file) throw new Error("Informe um único arquivo .xlsx.");
    else args.file = a;
  }
  if (!args.file) throw new Error("Uso: npm run import:scale -- <arquivo.xlsx> [--write] [--email <e-mail>]");
  return args as { file: string; write: boolean; email?: string };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = resolve(args.file);
  if (!existsSync(file)) throw new Error(`Arquivo não encontrado: ${args.file}`);

  const sheet = parseScaleSheet(await readSheetRows(readFileSync(file)));

  let sqlPath: string | undefined;
  if (args.write) {
    const seedEmail = existsSync(SEED) ? parseSeedOwnerEmail(readFileSync(SEED, "utf8")) : null;
    const email = args.email ?? seedEmail;
    if (!email) throw new Error("E-mail do dono não encontrado: use --email.");
    writeFileSync(SQL_OUT, toSql(sheet.measurements, email));
    sqlPath = relative(ROOT, SQL_OUT).replace(/\\/g, "/");
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, "report.md"),
    renderReport(sheet, { file: basename(file), generatedAt: new Date().toISOString(), mode: args.write ? "write" : "dry-run", sqlPath }),
  );

  const ms = sheet.measurements;
  // Só contagens no console: os valores ficam no relatório (fora do Git).
  console.log(
    [
      `Linhas lidas: ${sheet.rowsRead} · medições: ${ms.length} · ignoradas: ${sheet.skipped.length} · valores descartados: ${sheet.warnings.length}.`,
      `Período: ${ms.length ? `${ms[0].day} a ${ms[ms.length - 1].day}` : "—"} · colunas desconhecidas: ${sheet.unknownColumns.length} · métricas sem coluna: ${sheet.missingColumns.length}.`,
      `Relatório: scripts/scale/out/report.md${sqlPath ? ` · SQL: ${sqlPath}` : ""}`,
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(`Importação interrompida: ${(error as Error).message}`);
  process.exitCode = 1;
});
