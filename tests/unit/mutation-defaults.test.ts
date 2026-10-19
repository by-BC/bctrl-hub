import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dehydrate, hydrate, MutationObserver, onlineManager, QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { serializePersistedClient } from "@/components/providers/query-provider";
import { registerMutationDefaults, WRITES } from "@/lib/query/mutation-defaults";
import { upsertTask, type Task } from "@/features/tasks/api";

vi.mock("@/features/tasks/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/tasks/api")>()),
  upsertTask: vi.fn(async () => {}),
}));

const entries = Object.entries(WRITES);

describe("WRITES (fila offline)", () => {
  afterEach(() => onlineManager.setOnline(true));

  it("cada gravação tem chave própria [grupo, ação]", () => {
    const hashes = entries.map(([, w]) => JSON.stringify(w.mutationKey));
    expect(new Set(hashes).size).toBe(entries.length);
    for (const [, w] of entries) expect(w.mutationKey).toHaveLength(2);
  });

  it("registra a função de envio de todas as chaves com setMutationDefaults", () => {
    const qc = new QueryClient();
    registerMutationDefaults(qc);
    for (const [name, w] of entries) {
      expect(qc.getMutationDefaults(w.mutationKey).mutationFn, name).toBe(w.mutationFn);
    }
  });

  it("nenhum hook de feature grava com mutationFn fora do registro", () => {
    const features = join(process.cwd(), "src", "features");
    const offenders = readdirSync(features)
      .filter((f) => f !== "workout-session") // iniciar treino é leitura (networkMode "always")
      .map((f) => join(features, f, "hooks.ts"))
      .filter((file) => {
        try {
          return /^\s+mutationFn/m.test(readFileSync(file, "utf8"));
        } catch {
          return false;
        }
      });
    expect(offenders).toEqual([]);
  });

  it("gravação pausada sem rede sobrevive ao reload e é reenviada pela chave", async () => {
    const task: Task = { id: crypto.randomUUID(), title: "Comprar whey", done_at: null, created_at: "2026-10-19T12:00:00Z" } as Task;

    // Aba 1: sem rede, a mutação pausa (o hook nem precisa existir na aba 2).
    onlineManager.setOnline(false);
    const before = new QueryClient({ defaultOptions: { mutations: { networkMode: "offlineFirst", retry: 1, retryDelay: 1 } } });
    registerMutationDefaults(before);
    vi.mocked(upsertTask).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    void new MutationObserver(before, { ...WRITES.saveTask, scope: { id: "tasks" } }).mutate(task).catch(() => {});
    await vi.waitFor(() => expect(before.getMutationCache().getAll()[0].state.isPaused).toBe(true));
    const saved = JSON.parse(JSON.stringify(dehydrate(before)));
    expect(saved.mutations).toHaveLength(1);

    // Aba 2 (reaberta): reidrata, volta a rede e reenvia com a função registrada.
    const after = new QueryClient();
    registerMutationDefaults(after);
    hydrate(after, saved);
    onlineManager.setOnline(true);
    await after.resumePausedMutations();
    expect(upsertTask).toHaveBeenLastCalledWith(task);
    expect(after.isMutating()).toBe(0);
  });

  it("salva como pausada até a gravação em curso, para reenviar ao reabrir", () => {
    const qc = new QueryClient();
    const inFlight = qc.getMutationCache().build(qc, { ...WRITES.deleteTask, scope: { id: "tasks" } });
    void inFlight.execute("t1").catch(() => {});
    const dehydrated = dehydrate(qc, { shouldDehydrateMutation: (m) => m.state.status === "pending" });
    expect(dehydrated.mutations[0].state.isPaused).toBe(false);

    const saved = JSON.parse(serializePersistedClient({ timestamp: 1, buster: "x", clientState: dehydrated }));
    expect(saved.clientState.mutations[0].state).toMatchObject({ status: "pending", isPaused: true, variables: "t1" });
    expect(saved.clientState.mutations[0].mutationKey).toEqual(["tasks-edit", "delete"]);
  });
});
