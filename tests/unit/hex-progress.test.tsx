import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HexLegend, HexProgress, type HexSegments } from "@/components/shell/hex-progress";
import { HEX_SEGMENT_LENGTH } from "@/lib/domain/hex";

const segments: HexSegments = {
  workouts: { progress: 0.5, label: "Treinos", value: "2/4" },
  meals: { progress: 0.68, label: "Alimentação", value: "68%" },
  habits: { progress: 1.4, label: "Hábitos", value: "100%" },
};

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const fillOf = (segment: Element) => segment.querySelector("[data-fill]") as SVGPolylineElement;

describe("HexProgress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renderiza os 3 segmentos com aria-label e o progresso no SVG", () => {
    mockReducedMotion(false);
    render(<HexProgress segments={segments} />);

    expect(screen.getByRole("group", { name: "Progresso da semana" })).toBeInTheDocument();
    const imgs = screen.getAllByRole("img");
    expect(imgs.map((el) => el.getAttribute("aria-label"))).toEqual([
      "Treinos: 2/4, 50% da meta",
      "Alimentação: 68%, 68% da meta",
      "Hábitos: 100%, 100% da meta",
    ]);
    expect(imgs.map((el) => el.getAttribute("data-progress"))).toEqual(["0.50", "0.68", "1.00"]);

    // 2/4: metade do traço azul aparece.
    const workouts = fillOf(imgs[0]);
    expect(Number(workouts.getAttribute("stroke-dashoffset"))).toBeCloseTo(HEX_SEGMENT_LENGTH / 2);
    // Cada segmento tem o trilho (não preenchido) por baixo.
    for (const img of imgs) expect(img.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("o trilho vazio é igual nos 3 segmentos (o neutro não parece mais cheio que o azul)", () => {
    mockReducedMotion(true);
    const empty: HexSegments = {
      workouts: { ...segments.workouts, progress: 0 },
      meals: { ...segments.meals, progress: 0 },
      habits: { ...segments.habits, progress: 0 },
    };
    render(<HexProgress segments={empty} />);
    const tracks = screen.getAllByRole("img").map((img) => img.querySelector("[data-track]")!);
    const looks = tracks.map((t) => `${t.getAttribute("stroke")}|${t.getAttribute("stroke-opacity")}`);
    expect(new Set(looks).size).toBe(1);
    expect(Number(tracks[0].getAttribute("stroke-opacity"))).toBeLessThanOrEqual(0.15);
  });

  it("anima o preenchimento quando o movimento é permitido", () => {
    mockReducedMotion(false);
    render(<HexProgress segments={segments} />);
    const svg = screen.getByTestId("hex-progress");
    expect(svg).toHaveAttribute("data-motion", "full");
    expect(fillOf(screen.getAllByRole("img")[0]).style.animation).toContain("hex-fill");
  });

  it("com prefers-reduced-motion não há animação nem transição", () => {
    mockReducedMotion(true);
    render(<HexProgress segments={segments} />);
    expect(screen.getByTestId("hex-progress")).toHaveAttribute("data-motion", "reduced");
    for (const img of screen.getAllByRole("img")) {
      expect(fillOf(img).style.animation).toBe("");
      expect(fillOf(img).style.transition).toBe("");
    }
  });

  it("animate={false} desliga a animação (captura do story)", () => {
    mockReducedMotion(false);
    render(<HexProgress segments={segments} animate={false} />);
    expect(screen.getByTestId("hex-progress")).toHaveAttribute("data-motion", "reduced");
  });
});

describe("HexLegend", () => {
  it("mostra nome e número de cada segmento, com detalhe opcional", () => {
    render(<HexLegend segments={segments} details={{ meals: "15 de 22 refeições no plano" }} />);
    const legend = screen.getByTestId("hex-legend");
    expect(legend).toHaveTextContent("Treinos2/4");
    expect(legend).toHaveTextContent("Alimentação68%15 de 22 refeições no plano");
    expect(legend).toHaveTextContent("Hábitos100%");
  });
});
