"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

function hasErrorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code !== "";
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Usuário único: os dados só mudam por este aparelho. 30 s evita refetch a cada navegação.
        staleTime: 30_000,
        retry: 2,
      },
      mutations: {
        // Repete uma vez só falha de rede; erro do banco (com código) não muda ao reenviar.
        retry: (failures, error) => failures < 1 && !hasErrorCode(error),
      },
    },
  });
}

/**
 * Cliente do TanStack Query, um por aba.
 * A persistência da fila de mutações (offline) entra na task 10.0.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
