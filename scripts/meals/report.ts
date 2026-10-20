/**
 * Relatório do auto-vínculo do plano com a TACO (`scripts/meals/out/report.md`, fora do Git).
 * Puro: recebe o plano de vínculos e devolve o Markdown.
 */

import { optionMacros, roundMacros, type Food, type PlanItem } from "../../src/lib/domain/nutrition";
import type { TacoFood } from "../taco/taco";
import type { ItemLink, LinkPlan } from "./link";

const cell = (text: string | number | null | undefined) => String(text ?? "—").replace(/\|/g, "\\|").replace(/\n/g, " ");
const row = (...cells: (string | number | null | undefined)[]) => `| ${cells.map(cell).join(" | ")} |`;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const kcalOf = (l: ItemLink) => (l.food && l.grams !== null ? Math.round((l.food.kcal * l.grams) / 100) : null);
const foodLabel = (l: ItemLink) => (l.food ? (l.food.taco_id === null ? `${l.food.name} (próprio)` : l.food.name) : null);
const tacoLabel = (f: TacoFood) => `${f.taco_id} · ${f.name} (${fmt(f.kcal)} kcal/100 g)`;

export function renderLinkReport(plan: LinkPlan, meta: { generatedAt: string; source: string; sqlPath?: string }): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);
  const auto = plan.unique.filter((l) => l.status === "auto");
  const free = plan.unique.filter((l) => l.status === "free");
  const pending = plan.unique.filter((l) => l.status === "pending");
  const approx = auto.filter((l) => l.note && l.food?.taco_id !== null);
  const checks = plan.ownFoods.filter((f) => f.check);

  push(
    "# Vínculo do plano alimentar com a TACO",
    "",
    `Gerado em ${meta.generatedAt} a partir de \`${meta.source}\`. Fonte dos alimentos: TACO 4ª ed. — NEPA/Unicamp.`,
    "",
    "## Resumo",
    "",
    `- ${plan.options.length} opções, ${plan.unique.length} itens distintos (nome + quantidade).`,
    `- **${auto.length} vinculados** (${auto.filter((l) => l.food?.taco_id === null).length} a alimentos próprios; ${approx.length} com aproximação da TACO).`,
    `- **${plan.ownFoods.length} alimentos próprios** a criar (${checks.length} marcados "conferir").`,
    `- **${free.length} livres** (à vontade ou sem calorias: 0 kcal).`,
    `- **${pending.length} pendentes** (sem vínculo: ficam com o aviso "sem valor" até o dono decidir).`,
    meta.sqlPath ? `- SQL: \`${meta.sqlPath}\` (alimentos próprios, vínculos e livres).` : "- Dry-run: nenhum SQL gerado.",
    "",
  );

  if (plan.ownFoods.length > 0) {
    push(
      "## Alimentos próprios (por 100 g ou 100 ml)",
      "",
      row("Alimento", "kcal", "P (g)", "C (g)", "G (g)", "Observação"),
      row("---", "---:", "---:", "---:", "---:", "---"),
      ...plan.ownFoods.map((f) =>
        row(f.name, fmt(f.kcal), fmt(f.protein_g), fmt(f.carbs_g), fmt(f.fat_g), [f.check ? "**conferir**" : "", f.note ?? ""].filter(Boolean).join(" — ") || null),
      ),
      "",
    );
  }

  push(
    "## Vinculados",
    "",
    row("Item", "Quantidade", "Alimento", "Gramas", "kcal", "Via"),
    row("---", "---", "---", "---:", "---:", "---"),
    ...auto.map((l) => row(l.name, l.qty, foodLabel(l), l.grams, kcalOf(l), l.via)),
    "",
  );

  if (approx.length > 0) {
    push("### Aproximações (conferir)", "", ...approx.map((l) => `- **${l.name}** (${l.qty}) → ${l.food?.name}: ${l.note}.`), "");
  }

  push("## Livres (0 kcal)", "", ...free.map((l) => `- ${l.name} (${l.qty}) — ${l.via}`), "");

  push(
    "## Pendentes e sugestões",
    "",
    "Para decidir: vincule no app (Comida → Editar plano → item → Vincular) ou anote em",
    "`scripts/meals/data/overrides.json` (`{ \"nome do item\": <id TACO> | \"free\" | \"pending\" }`) e rode o script de novo.",
    "",
    row("Item", "Quantidade", "Motivo", "Sugestões da TACO"),
    row("---", "---", "---", "---"),
    ...pending.map((l) =>
      row(
        l.name,
        l.qty,
        l.note ?? (l.food ? `TACO: ${l.food.name}` : "sem correspondência"),
        l.suggestions.length ? l.suggestions.map(tacoLabel).join("; ") : "—",
      ),
    ),
    "",
  );

  // Estimativa por opção depois de aplicar (mesma conta do app).
  const foods = new Map<string, Food>();
  const items = (links: ItemLink[]): PlanItem[] =>
    links.map((l) => {
      if (l.status === "free") return { name: l.name, qty: l.qty, free: true };
      if (l.status !== "auto" || !l.food) return { name: l.name, qty: l.qty, free: false };
      const id = l.food.taco_id === null ? `own-${l.food.own_key}` : `taco-${l.food.taco_id}`;
      foods.set(id, { id, ...l.food });
      return { name: l.name, qty: l.qty, food_id: id, grams: l.grams };
    });
  const perOption = plan.options.map(({ option, links }) => ({ option, ...optionMacros(items(links), foods) }));

  push(
    "## Opções depois de aplicar",
    "",
    row("Refeição", "Opção", "kcal", "P (g)", "C (g)", "G (g)", "Sem valor"),
    row("---", "---", "---:", "---:", "---:", "---:", "---:"),
    ...perOption.map(({ option, total, unresolved }) => {
      const r = roundMacros(total);
      return row(option.meal, `${option.position}. ${option.title}`, r.kcal, fmt(r.protein), fmt(r.carbs), fmt(r.fat), unresolved);
    }),
    "",
    "Substituições (texto livre dos itens) não são vinculadas.",
    "",
  );
  return out.join("\n");
}
