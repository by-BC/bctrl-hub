"use client";

import { QueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  PersistQueryClientProvider,
  type PersistedClient,
  type PersistQueryClientOptions,
} from "@tanstack/react-query-persist-client";
import { useState, type ReactNode } from "react";
import { registerMutationDefaults } from "@/lib/query/mutation-defaults";

/** Chave no `localStorage` da fila de gravações pendentes. */
export const QUERY_CACHE_KEY = "bctrl.queryCache";

/**
 * Versão do formato salvo. Trocar quando mudar a forma das variáveis de alguma gravação em
 * `WRITES`: o que estiver salvo com outra versão é descartado em vez de ir errado ao banco.
 */
const CACHE_BUSTER = "bctrl-v3-meal-items";

/** Pendências mais velhas que isto são descartadas (o Safari apaga o site após ~7 dias sem uso). */
const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/** Falha de rede com sinal fraco: ~2 min de tentativas (1 s, 2 s, 4 s… até 30 s) antes de desistir. */
const MAX_NETWORK_RETRIES = 8;

function hasErrorCode(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && code !== "";
}

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Usuário único: os dados só mudam por este aparelho. 30 s evita refetch a cada navegação.
        staleTime: 30_000,
        retry: 2,
      },
      mutations: {
        // Tenta enviar mesmo que o navegador diga "offline"; se falhar sem rede, pausa e
        // espera a conexão voltar (em vez de dar erro e desfazer o que foi marcado).
        networkMode: "offlineFirst",
        // Repete só falha de rede; erro do banco (com código) não muda ao reenviar.
        retry: (failures, error) => failures < MAX_NETWORK_RETRIES && !hasErrorCode(error),
      },
    },
  });
  registerMutationDefaults(client);
  return client;
}

/**
 * Toda gravação salva volta como "pausada": ao reabrir, `resumePausedMutations` reenvia
 * inclusive a que estava em curso (ou esperando nova tentativa) quando o app fechou.
 * Reenviar é seguro: as gravações são idempotentes (id do cliente + upsert).
 */
export function serializePersistedClient(client: PersistedClient) {
  const mutations = client.clientState.mutations.map((m) => ({ ...m, state: { ...m.state, isPaused: true } }));
  return JSON.stringify({ ...client, clientState: { ...client.clientState, mutations } });
}

function makePersistOptions(): Omit<PersistQueryClientOptions, "queryClient"> {
  return {
    // No servidor não há `localStorage`: o persister vira no-op.
    persister: createSyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: QUERY_CACHE_KEY,
      serialize: serializePersistedClient,
    }),
    buster: CACHE_BUSTER,
    maxAge: CACHE_MAX_AGE,
    dehydrateOptions: {
      // Só a fila: as leituras (dados de saúde) não ficam gravadas no aparelho.
      shouldDehydrateQuery: () => false,
      // Pausadas (sem rede) e em curso: nada que ainda não chegou ao servidor se perde.
      shouldDehydrateMutation: (mutation) => mutation.state.status === "pending",
    },
  };
}

/**
 * Cliente do TanStack Query, um por aba, com a fila de gravações persistida.
 *
 * Gravação feita sem rede fica pausada e salva no `localStorage`. Ao reabrir o app, ela é
 * reidratada e reenviada aqui (`onSuccess`, depois de restaurar). Com o app aberto, o
 * `onlineManager` do TanStack escuta o evento `online` do navegador e retoma a fila sozinho.
 * A sessão de treino tem a fila própria (`pendingSync` no store), fora daqui.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  const [persistOptions] = useState(makePersistOptions);
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={persistOptions}
      onSuccess={() => {
        // Sem `return`: a tela não espera o reenvio para carregar; as leituras se atualizam
        // quando ele termina (o `onSettled` padrão de cada gravação revalida o cache).
        void client.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

/** Sair: descarta o cache e a fila salva (outro login não herda nada deste). */
export function clearQueryCache(client: QueryClient) {
  client.clear();
  try {
    window.localStorage.removeItem(QUERY_CACHE_KEY);
  } catch {
    // Armazenamento bloqueado: nada salvo para apagar.
  }
}
