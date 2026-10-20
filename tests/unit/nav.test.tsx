import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NAV_ITEMS, isActivePath } from "@/components/shell/nav-items";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

const { BottomNav } = await import("@/components/shell/bottom-nav");

describe("isActivePath", () => {
  it("Hoje só fica ativo na raiz", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/treino", "/")).toBe(false);
  });

  it("marca a seção nas sub-rotas", () => {
    expect(isActivePath("/treino", "/treino")).toBe(true);
    expect(isActivePath("/treino/sessao", "/treino")).toBe(true);
    expect(isActivePath("/treino/historico/abc/story", "/treino")).toBe(true);
  });

  it("não confunde prefixos parecidos", () => {
    expect(isActivePath("/treinos", "/treino")).toBe(false);
    expect(isActivePath("/comidas", "/comida")).toBe(false);
  });
});

describe("NAV_ITEMS", () => {
  it("tem no máximo 5 itens na barra do celular", () => {
    expect(NAV_ITEMS.filter((i) => i.mobile).length).toBeLessThanOrEqual(5);
  });

  it("Perfil fica na lateral do desktop, fora da barra do celular (vai no cabeçalho)", () => {
    expect(NAV_ITEMS.find((i) => i.href === "/perfil")).toMatchObject({ label: "Perfil", mobile: false });
  });
});

describe("BottomNav", () => {
  beforeEach(() => {
    pathname.current = "/";
  });

  it("mostra as 5 seções principais", () => {
    render(<BottomNav />);
    for (const label of ["Hoje", "Treino", "Comida", "Hábitos", "Tarefas"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("destaca a rota ativa com aria-current", () => {
    pathname.current = "/treino/sessao";
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: "Treino" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hoje" })).not.toHaveAttribute("aria-current");
  });
});
