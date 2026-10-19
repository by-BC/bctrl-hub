"use client";

import { useSyncExternalStore } from "react";
import { dayInSaoPaulo } from "@/lib/domain/day";

const noop = () => () => {};

/**
 * Dia de hoje (America/Sao_Paulo) só no navegador. Na pré-renderização devolve `null`:
 * com Cache Components, ler a hora atual no servidor quebraria o shell estático.
 */
export function useToday(): string | null {
  return useSyncExternalStore(noop, () => dayInSaoPaulo(new Date()), () => null);
}
