/**
 * Cliente mínimo da API oficial do Hevy (https://api.hevyapp.com/v1), só leitura.
 * Paginação até o fim e backoff exponencial em 429/5xx/erro de rede (até 5 tentativas).
 * A chave vai só no header `api-key`: nunca entra em mensagem de erro, log ou arquivo.
 */

import type { HevyTemplate, HevyWorkout } from "./map";

export const HEVY_API_URL = "https://api.hevyapp.com/v1";
const MAX_ATTEMPTS = 5;
const TEMPLATES_PAGE_SIZE = 100; // maior aceito pela API
const WORKOUTS_PAGE_SIZE = 10; // a API recusa mais que 10

export class HevyApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "HevyApiError";
  }
}

/** Lê a chave do ambiente e falha cedo, sem mostrar o valor. */
export function readApiKey(env: Record<string, string | undefined>): string {
  const key = env.HEVY_API_KEY?.trim();
  if (!key) throw new Error("HEVY_API_KEY não definida: coloque a chave no .env.local (nunca no Git).");
  return key;
}

export type HevyClientOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  baseUrl?: string;
  baseDelayMs?: number;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const retryable = (status: number) => status === 429 || status >= 500;

export function createHevyClient(options: HevyClientOptions) {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const baseUrl = options.baseUrl ?? HEVY_API_URL;
  const baseDelayMs = options.baseDelayMs ?? 1000;

  async function get<T>(path: string): Promise<T> {
    let lastError: HevyApiError | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await doFetch(`${baseUrl}${path}`, {
          headers: { "api-key": options.apiKey, accept: "application/json" },
        });
      } catch (error) {
        lastError = new HevyApiError(`Falha de rede em GET ${path}: ${(error as Error).message}`, null);
        if (attempt < MAX_ATTEMPTS) await sleep(baseDelayMs * 2 ** (attempt - 1));
        continue;
      }

      if (response.ok) return (await response.json()) as T;

      lastError = new HevyApiError(`GET ${path} respondeu ${response.status}.`, response.status);
      if (!retryable(response.status)) throw lastError;
      if (attempt < MAX_ATTEMPTS) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : baseDelayMs * 2 ** (attempt - 1));
      }
    }
    throw new HevyApiError(`${lastError?.message ?? "Erro"} Desisti após ${MAX_ATTEMPTS} tentativas.`, lastError?.status ?? null);
  }

  async function paginate<T>(resource: string, key: string, pageSize: number): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; ; page++) {
      const body = await get<{ page_count?: number } & Record<string, unknown>>(
        `/${resource}?page=${page}&pageSize=${pageSize}`,
      );
      const items = body[key];
      if (!Array.isArray(items)) throw new HevyApiError(`Resposta de /${resource} sem "${key}".`, 200);
      all.push(...(items as T[]));
      if (page >= (body.page_count ?? 1)) return all;
    }
  }

  return {
    listExerciseTemplates: () => paginate<HevyTemplate>("exercise_templates", "exercise_templates", TEMPLATES_PAGE_SIZE),
    listWorkouts: () => paginate<HevyWorkout>("workouts", "workouts", WORKOUTS_PAGE_SIZE),
    workoutCount: async () => (await get<{ workout_count: number }>("/workouts/count")).workout_count,
  };
}

export type HevyClient = ReturnType<typeof createHevyClient>;
