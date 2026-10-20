import { describe, expect, it, vi } from "vitest";
import { createHevyClient, readApiKey, HevyApiError } from "../../scripts/hevy/api";

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

/** `fetch` simulado: devolve as respostas em ordem e guarda as chamadas. */
function fakeFetch(replies: Reply[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> });
    const reply = replies.shift();
    if (!reply) throw new Error("chamada inesperada");
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: reply.headers,
    });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const noSleep = async () => {};

describe("readApiKey", () => {
  it("falha cedo se a chave faltar, sem vazar valor", () => {
    expect(() => readApiKey({})).toThrow(/HEVY_API_KEY/);
    expect(() => readApiKey({ HEVY_API_KEY: "  " })).toThrow(/HEVY_API_KEY/);
    expect(readApiKey({ HEVY_API_KEY: " abc " })).toBe("abc");
  });
});

describe("createHevyClient", () => {
  it("pagina até o fim e manda a chave no header api-key", async () => {
    const { fn, calls } = fakeFetch([
      { status: 200, body: { page: 1, page_count: 2, exercise_templates: [{ id: "A" }, { id: "B" }] } },
      { status: 200, body: { page: 2, page_count: 2, exercise_templates: [{ id: "C" }] } },
    ]);
    const client = createHevyClient({ apiKey: "segredo", fetch: fn, sleep: noSleep });
    const all = await client.listExerciseTemplates();
    expect(all.map((t) => t.id)).toEqual(["A", "B", "C"]);
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.hevyapp.com/v1/exercise_templates?page=1&pageSize=100",
      "https://api.hevyapp.com/v1/exercise_templates?page=2&pageSize=100",
    ]);
    expect(calls[0].headers["api-key"]).toBe("segredo");
  });

  it("treinos usam pageSize 10 (limite da API)", async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: { page: 1, page_count: 1, workouts: [{ id: "w1" }] } }]);
    const client = createHevyClient({ apiKey: "k", fetch: fn, sleep: noSleep });
    expect((await client.listWorkouts()).map((w) => w.id)).toEqual(["w1"]);
    expect(calls[0].url).toBe("https://api.hevyapp.com/v1/workouts?page=1&pageSize=10");
  });

  it("lê a contagem de treinos", async () => {
    const { fn } = fakeFetch([{ status: 200, body: { workout_count: 82 } }]);
    const client = createHevyClient({ apiKey: "k", fetch: fn, sleep: noSleep });
    expect(await client.workoutCount()).toBe(82);
  });

  it("refaz com backoff exponencial em 429 e 5xx (respeitando Retry-After)", async () => {
    const { fn, calls } = fakeFetch([
      { status: 429, headers: { "retry-after": "3" } },
      { status: 503 },
      { status: 200, body: { page: 1, page_count: 1, workouts: [] } },
    ]);
    const sleep = vi.fn(async (ms: number) => void ms);
    const client = createHevyClient({ apiKey: "k", fetch: fn, sleep, baseDelayMs: 100 });
    await client.listWorkouts();
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([3000, 200]);
  });

  it("refaz em erro de rede", async () => {
    let first = true;
    const fn = vi.fn(async () => {
      if (first) {
        first = false;
        throw new TypeError("fetch failed");
      }
      return new Response(JSON.stringify({ workout_count: 1 }), { status: 200 });
    }) as unknown as typeof fetch;
    const client = createHevyClient({ apiKey: "k", fetch: fn, sleep: noSleep });
    expect(await client.workoutCount()).toBe(1);
  });

  it("desiste depois de 5 tentativas", async () => {
    const { fn, calls } = fakeFetch(Array.from({ length: 5 }, () => ({ status: 500 })));
    const client = createHevyClient({ apiKey: "k", fetch: fn, sleep: noSleep });
    await expect(client.workoutCount()).rejects.toBeInstanceOf(HevyApiError);
    expect(calls).toHaveLength(5);
  });

  it("não refaz em 4xx e não expõe a chave na mensagem", async () => {
    const { fn, calls } = fakeFetch([{ status: 401, body: { error: "Unauthorized" } }]);
    const client = createHevyClient({ apiKey: "segredo-123", fetch: fn, sleep: noSleep });
    const error = await client.workoutCount().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HevyApiError);
    expect((error as Error).message).toMatch(/401/);
    expect((error as Error).message).not.toMatch(/segredo/);
    expect(calls).toHaveLength(1);
  });
});
