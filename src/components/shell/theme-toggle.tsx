"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export function nextTheme(current: string | undefined) {
  return current === "light" ? "dark" : "light";
}

const noopSubscribe = () => () => {};

/** false no servidor e na hidratação; true depois de montar no navegador. */
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const target = nextTheme(resolvedTheme);

  // O servidor não conhece o tema salvo: rótulo neutro até montar, para o
  // HTML do servidor e o do cliente baterem (sem erro de hidratação).
  const label = !mounted ? "Alternar tema" : target === "light" ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <Button variant="ghost" size="icon" className="size-11" onClick={() => setTheme(target)} aria-label={label}>
      {/* Os dois ícones existem; o CSS mostra o certo sem esperar a hidratação. */}
      <Sun aria-hidden className="hidden size-5 dark:block" />
      <Moon aria-hidden className="size-5 dark:hidden" />
    </Button>
  );
}
