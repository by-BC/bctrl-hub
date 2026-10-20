import { describe, expect, it } from "vitest";
import {
  catalogFacets,
  EMPTY_FILTERS,
  equipmentLabel,
  filterCatalog,
  hasActiveFilters,
  toggleValue,
  visibleCount,
  type CatalogItem,
} from "@/lib/domain/catalog";

const items: CatalogItem[] = [
  { id: "1", name: "Supino Reto (Halter)", muscle_group: "Peito", equipment: "Halter" },
  { id: "2", name: "Supino Reto (Barra)", muscle_group: "Peito", equipment: "Barra" },
  { id: "3", name: "Crucifixo Inclinado (Halter)", muscle_group: "Peito", equipment: "Halter" },
  { id: "4", name: "Remada Curvada (Halter)", muscle_group: "Costas", equipment: "Halter" },
  { id: "5", name: "Elevação Pélvica", muscle_group: "Glúteos", equipment: "Nenhum" },
  { id: "6", name: "Abdutora", muscle_group: null, equipment: null },
  { id: "7", name: "Rosca Martelo (Halter)", muscle_group: "Bíceps", equipment: "Halter" },
];

const ids = (list: CatalogItem[]) => list.map((i) => i.id);
const f = (patch: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...patch });

describe("filterCatalog", () => {
  it("sem filtro: todos em ordem alfabética (pt-BR)", () => {
    expect(ids(filterCatalog(items, EMPTY_FILTERS))).toEqual(["6", "3", "5", "4", "7", "2", "1"]);
  });

  it("busca ignora acento e caixa", () => {
    expect(ids(filterCatalog(items, f({ query: "elevacao pelvica" })))).toEqual(["5"]);
    expect(ids(filterCatalog(items, f({ query: "GLÚTEO" })))).toEqual(["5"]);
  });

  it("busca exige todas as palavras (nome, músculo ou equipamento)", () => {
    expect(ids(filterCatalog(items, f({ query: "supino halter" })))).toEqual(["1"]);
    expect(ids(filterCatalog(items, f({ query: "costas halter" })))).toEqual(["4"]);
    expect(ids(filterCatalog(items, f({ query: "sem equipamento" })))).toEqual(["5"]);
    expect(filterCatalog(items, f({ query: "agachamento" }))).toEqual([]);
  });

  it("Peito + Halter: só os que atendem aos dois", () => {
    expect(ids(filterCatalog(items, f({ muscles: ["Peito"], equipment: ["Halter"] })))).toEqual(["3", "1"]);
  });

  it("chips do mesmo grupo somam; grupos diferentes se combinam", () => {
    expect(ids(filterCatalog(items, f({ muscles: ["Peito", "Costas"] })))).toEqual(["3", "4", "2", "1"]);
    expect(ids(filterCatalog(items, f({ muscles: ["Peito", "Costas"], equipment: ["Barra"] })))).toEqual(["2"]);
    expect(ids(filterCatalog(items, f({ muscles: ["Peito"], query: "crucifixo" })))).toEqual(["3"]);
  });

  it("exercício sem músculo ou equipamento sai quando o filtro está ativo", () => {
    expect(ids(filterCatalog(items, f({ muscles: ["Glúteos"] })))).toEqual(["5"]);
    expect(ids(filterCatalog(items, f({ equipment: ["Nenhum"] })))).toEqual(["5"]);
  });

  it("com busca, ordena por relevância: começo do nome > começo de palavra > contém", () => {
    const list: CatalogItem[] = [
      { id: "a", name: "Crossover na Polia", muscle_group: "Peito" },
      { id: "b", name: "Tríceps na Polia", muscle_group: "Tríceps" },
      { id: "c", name: "Polia Alta", muscle_group: "Costas" },
      { id: "d", name: "Superpolia", muscle_group: "Costas" },
    ];
    expect(ids(filterCatalog(list, f({ query: "polia" })))).toEqual(["c", "a", "b", "d"]);
  });

  it("não altera a lista de entrada", () => {
    const copy = [...items];
    filterCatalog(items, f({ query: "supino" }));
    expect(items).toEqual(copy);
  });
});

describe("catalogFacets", () => {
  it("conta por músculo e equipamento, do mais comum ao mais raro, sem nulos", () => {
    const { muscles, equipment } = catalogFacets(items);
    expect(muscles.map((m) => [m.value, m.count])).toEqual([
      ["Peito", 3],
      ["Bíceps", 1],
      ["Costas", 1],
      ["Glúteos", 1],
    ]);
    expect(equipment.map((e) => [e.value, e.label, e.count])).toEqual([
      ["Halter", "Halter", 4],
      ["Barra", "Barra", 1],
      ["Nenhum", "Sem equipamento", 1],
    ]);
  });
});

describe("auxiliares", () => {
  it("equipmentLabel, toggleValue e hasActiveFilters", () => {
    expect(equipmentLabel("Nenhum")).toBe("Sem equipamento");
    expect(equipmentLabel("Halter")).toBe("Halter");
    expect(toggleValue(["Peito"], "Costas")).toEqual(["Peito", "Costas"]);
    expect(toggleValue(["Peito", "Costas"], "Peito")).toEqual(["Costas"]);
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters(f({ query: "  " }))).toBe(false);
    expect(hasActiveFilters(f({ equipment: ["Barra"] }))).toBe(true);
  });

  it("visibleCount pagina em blocos e não passa do total", () => {
    expect(visibleCount(455, 1)).toBe(40);
    expect(visibleCount(455, 2)).toBe(80);
    expect(visibleCount(30, 3)).toBe(30);
    expect(visibleCount(455, 0)).toBe(40);
  });
});
