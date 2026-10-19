import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const theme = vi.hoisted(() => ({ resolved: "dark", setTheme: vi.fn() }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: theme.resolved, setTheme: theme.setTheme }),
}));

const { ThemeToggle, nextTheme } = await import("@/components/shell/theme-toggle");

describe("nextTheme", () => {
  it("alterna entre claro e escuro", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });

  it("antes de hidratar (undefined) assume o padrão escuro e oferece o claro", () => {
    expect(nextTheme(undefined)).toBe("light");
  });
});

describe("ThemeToggle", () => {
  beforeEach(() => theme.setTheme.mockClear());

  it("no escuro oferece o tema claro", async () => {
    theme.resolved = "dark";
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Ativar tema claro" });
    await userEvent.click(button);
    expect(theme.setTheme).toHaveBeenCalledWith("light");
  });

  it("no claro oferece o tema escuro", async () => {
    theme.resolved = "light";
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Ativar tema escuro" }));
    expect(theme.setTheme).toHaveBeenCalledWith("dark");
  });
});
