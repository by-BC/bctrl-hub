/**
 * Relatório da importação do Hevy em Markdown (`scripts/hevy/out/report.md`, fora do Git).
 * Puro: recebe o plano e devolve o texto.
 */

import { normalizeName, type ImportPlan, type Skipped } from "./map";

export type ReportMeta = {
  generatedAt: string;
  mode: "dry-run" | "write";
  existingSource: string;
  existingCount: number;
  apiWorkoutCount: number | null;
  sqlPath?: string;
};

const cell = (text: string | number | null) => String(text ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (...cells: (string | number | null)[]) => `| ${cells.map(cell).join(" | ")} |`;

function groupSkipped(skipped: readonly Skipped[]) {
  const groups = new Map<string, Skipped[]>();
  for (const s of skipped) {
    const key = `${s.kind}: ${s.reason.replace(/modelo \S+ /, "modelo ")}`;
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
}

export function renderReport(plan: ImportPlan, meta: ReportMeta): string {
  const { stats, links } = plan;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);
  const byId = new Map(plan.catalog.map((c) => [c.hevy_template_id, c]));
  const linkedTo = new Map(links.links.map((l) => [l.hevyTemplateId, l.existingName]));
  const uses = (id: string) => plan.usage.get(id) ?? 0;
  const base = (name: string) => normalizeName(name.replace(/\(.*\)/g, ""));
  /** Outros modelos do mesmo exercício-base usados no histórico (ex.: "Rosca Direta (Halter)"). */
  const variants = (id: string, catalogName: string) =>
    plan.catalog
      .filter((c) => c.hevy_template_id !== id && uses(c.hevy_template_id) > 0 && base(c.name) === base(catalogName))
      .map((c) => `${c.name} \`${c.hevy_template_id}\` (${uses(c.hevy_template_id)})`)
      .join("; ");

  push(
    "# Importação do Hevy — relatório",
    "",
    `Gerado em ${meta.generatedAt} · modo **${meta.mode}**${meta.sqlPath ? ` · SQL em \`${meta.sqlPath}\`` : " · nenhum SQL gerado"}.`,
    `Exercícios atuais do app lidos de \`${meta.existingSource}\` (${meta.existingCount}).`,
    "",
    "## Resumo",
    "",
    row("Item", "Quantidade"),
    row("---", "---:"),
    row("Modelos de exercício na API (catálogo + personalizados)", stats.templates),
    row("… personalizados (`hevy_custom`)", stats.customTemplates),
    row("… sem nome em PT (fica o original)", stats.withoutPt),
    row("… com vídeo (link)", stats.withMedia),
    row("Exercícios atuais vinculados ao catálogo", links.links.length),
    row("Exercícios atuais pendentes de revisão", links.pending.length),
    row("Exercícios atuais mantidos sem vínculo (override)", links.kept.length),
    row("Exercícios novos a criar (catálogo − vinculados)", stats.templates - links.links.length),
    row("Treinos na API (`/workouts/count`)", meta.apiWorkoutCount),
    row("Treinos lidos da API (paginação)", stats.workoutsFromApi),
    row("Treinos a importar", stats.workoutsImported),
    row("Exercícios em treinos", stats.exercisesImported),
    row("Séries a importar", stats.setsImported),
    row("… normais / aquecimento / até a falha / drop set", `${stats.setsByType.normal} / ${stats.setsByType.warmup} / ${stats.setsByType.failure} / ${stats.setsByType.dropset}`),
    row("Recordes (PR) calculados no histórico", stats.prs),
    row("Itens ignorados", plan.skipped.length),
    row("Período", stats.firstDay ? `${stats.firstDay} a ${stats.lastDay}` : null),
    "",
  );

  if (links.errors.length) {
    push("## ⚠ Erros em `overrides.json` (o `--write` recusa até corrigir)", "", ...links.errors.map((e) => `- ${e}`), "");
  }

  push(
    "## Vínculos automáticos",
    "",
    "O exercício do app mantém o id e o nome; ganha o modelo do Hevy (tipo, músculos, equipamento, mídia) e recebe o histórico desse modelo.",
    "",
    "Treinos = quantos treinos do Hevy usam o modelo (o histórico que passa para o exercício do app). Variantes = outros modelos do mesmo exercício-base usados no histórico, que viram exercícios separados.",
    "",
    row("Exercício no app", "Modelo no Hevy", "Nome no catálogo (EN)", "Método", "Treinos", "Variantes no histórico"),
    row("---", "---", "---", "---", "---:", "---"),
    ...links.links.map((l) =>
      row(
        l.existingName,
        l.hevyTemplateId,
        `${l.catalogName} (${byId.get(l.hevyTemplateId)?.name_en ?? "?"})`,
        l.method,
        uses(l.hevyTemplateId),
        variants(l.hevyTemplateId, l.catalogName) || null,
      ),
    ),
    "",
    "## Pendentes (revisar e decidir em `scripts/hevy/data/overrides.json`)",
    "",
  );
  if (links.pending.length === 0) push("Nenhum.", "");
  else {
    push(
      'Formato: `{ "Nome no app": "ID_DO_MODELO" }` para vincular, ou `{ "Nome no app": null }` para manter separado.',
      "Sem decisão, o exercício fica como está e o histórico do Hevy vai para o exercício do catálogo.",
      "",
    );
    for (const p of links.pending) {
      const tips = p.suggestions.map((s) => `\`${s.hevyTemplateId}\` ${s.name} (${uses(s.hevyTemplateId)} treinos)`).join("; ");
      push(`- **${p.existingName}** — ${p.reason}.${tips ? ` Sugestões: ${tips}.` : ""}`);
    }
    push("");
  }
  if (links.kept.length) {
    push("## Mantidos sem vínculo", "", ...links.kept.map((k) => `- ${k.existingName} — ${k.reason}`), "");
  }

  // Uso de cada modelo no histórico: mostra para onde vai a evolução.
  const sessions = new Map<string, number>();
  for (const w of plan.workouts) for (const e of new Set(w.exercises.map((x) => x.hevy_template_id))) sessions.set(e, (sessions.get(e) ?? 0) + 1);
  const used = [...sessions.entries()].sort((a, b) => b[1] - a[1] || (byId.get(a[0])?.name ?? "").localeCompare(byId.get(b[0])?.name ?? "", "pt-BR"));
  push(
    "## Exercícios usados no histórico do Hevy",
    "",
    row("Exercício (catálogo)", "Original (EN)", "Modelo", "Treinos", "Destino no app"),
    row("---", "---", "---", "---:", "---"),
    ...used.map(([id, n]) => {
      const c = byId.get(id);
      const dest = linkedTo.has(id) ? `vinculado a "${linkedTo.get(id)}"` : c?.source === "hevy_custom" ? "novo (personalizado)" : "novo exercício do catálogo";
      return row(c?.name ?? id, c?.name_en ?? null, id, n, dest);
    }),
    "",
  );

  if (plan.renamed.length) {
    push(
      "## Nomes ajustados (nome repetido)",
      "",
      ...plan.renamed.map((r) => `- \`${r.hevyTemplateId}\`: "${r.from}" → "${r.to}"`),
      "",
    );
  }

  const noPt = plan.catalog.filter((c) => !c.has_pt);
  if (noPt.length) {
    push(
      "## Sem nome em PT",
      "",
      ...noPt.map((c) => `- \`${c.hevy_template_id}\` ${c.name}${c.source === "hevy_custom" ? " (personalizado: nome original)" : ""}`),
      "",
    );
  }

  push("## Itens ignorados (com motivo)", "");
  if (plan.skipped.length === 0) push("Nenhum.", "");
  for (const [reason, items] of groupSkipped(plan.skipped)) {
    push(`- **${reason}** (${items.length})`, ...items.slice(0, 30).map((s) => `  - ${s.ref}`));
    if (items.length > 30) push(`  - … e mais ${items.length - 30}`);
  }
  push(
    "",
    "## Observações",
    "",
    `- Não importados: RPE (${stats.rpeIgnored} séries com RPE), \`custom_metric\`, superséries e a rotina do Hevy (\`routine_id\` fica nulo).`,
    "- Datas: `start_time`/`end_time` (UTC) viram `started_at`/`finished_at`; o `day` é o dia em America/Sao_Paulo.",
    "- Recordes (`pr_kinds`) calculados só com o histórico do Hevy, em ordem cronológica e sem aquecimento (mesmas regras do app).",
    "- Mídia por link (miniatura da API, vídeo do site). Nada é copiado; instruções do Hevy não são importadas.",
    "- Treinos do Hevy no mesmo dia de um treino já registrado no app não são mesclados: confira o histórico após aplicar.",
    "",
  );
  return out.join("\n");
}
