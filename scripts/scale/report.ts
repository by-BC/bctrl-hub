/**
 * Relatório da importação da balança (`scripts/scale/out/report.md`, fora do Git): o que o dono
 * revisa antes do `--write`. Puro: recebe o resultado do parser e devolve o Markdown.
 */

import { METRIC, METRICS } from "../../src/lib/domain/composition";
import type { ScaleSheet } from "./parse";

export type ReportOptions = {
  file: string;
  generatedAt: string;
  mode: "dry-run" | "write";
  sqlPath?: string;
};

const cell = (s: string) => s.replace(/\|/g, "\\|");

export function renderReport(sheet: ScaleSheet, opts: ReportOptions): string {
  const { measurements: ms, skipped, warnings } = sheet;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);
  const period = ms.length ? `${ms[0].day} a ${ms[ms.length - 1].day}` : "—";
  const days = new Set(ms.map((m) => m.day)).size;

  push(
    "# Importação da planilha da balança",
    "",
    `Gerado em ${opts.generatedAt} · modo **${opts.mode}** · arquivo \`${cell(opts.file)}\``,
    "",
    "## Resumo",
    "",
    "| Item | Valor |",
    "|---|---|",
    `| Linhas de dados lidas | ${sheet.rowsRead} |`,
    `| Medições importadas | ${ms.length} |`,
    `| Dias com medição (peso em body_weights, source = scale) | ${days} |`,
    `| Linhas ignoradas | ${skipped.length} |`,
    `| Valores descartados (viram null) | ${warnings.length} |`,
    `| Período | ${period} |`,
    `| Perfil da planilha | ${[sheet.header.sex, sheet.header.age !== undefined ? `${sheet.header.age} anos` : "", sheet.header.heightCm !== undefined ? `${sheet.header.heightCm} cm` : ""].filter(Boolean).join(" · ") || "—"} |`,
  );
  if (opts.sqlPath) push(`| SQL gerado | \`${opts.sqlPath}\` |`);

  push("", "## Métricas presentes", "", "| Métrica | Medições com valor |", "|---|---|");
  for (const def of METRICS) {
    const n = ms.filter((m) => m.values[def.key] !== null).length;
    push(`| ${def.label} | ${n}/${ms.length} |`);
  }

  push("", "## Colunas", "");
  push(sheet.unknownColumns.length ? `- Desconhecidas (ignoradas): ${sheet.unknownColumns.map((c) => `"${cell(c)}"`).join(", ")}` : "- Nenhuma coluna desconhecida.");
  push(
    sheet.missingColumns.length
      ? `- Sem coluna na planilha (ficam vazias): ${sheet.missingColumns.map((k) => METRIC[k].label).join(", ")}`
      : "- Todas as 17 métricas têm coluna.",
  );

  push("", "## Linhas ignoradas", "");
  if (skipped.length === 0) push("Nenhuma.");
  else {
    push("| Linha | Motivo |", "|---|---|");
    for (const s of skipped) push(`| ${s.row} | ${cell(s.reason)} |`);
  }

  push("", "## Valores descartados (a medição continua)", "");
  if (warnings.length === 0) push("Nenhum.");
  else {
    push("| Linha | Métrica | Valor | Motivo |", "|---|---|---|---|");
    for (const w of warnings) push(`| ${w.row} | ${METRIC[w.metric].label} | ${cell(w.value)} | ${w.reason} |`);
  }

  push("", "## Medições", "", "| Linha | Instante | Dia | Peso | Gordura % | Músculo esq. kg | Visceral | Massa magra kg |", "|---|---|---|---|---|---|---|---|");
  const v = (n: number | null) => (n === null ? "—" : String(n));
  for (const m of ms) {
    const x = m.values;
    push(`| ${m.row} | ${m.measured_at} | ${m.day} | ${v(x.weight_kg)} | ${v(x.body_fat_pct)} | ${v(x.skeletal_muscle_kg)} | ${v(x.visceral_fat)} | ${v(x.lean_mass_kg)} |`);
  }

  push("");
  return out.join("\n");
}
