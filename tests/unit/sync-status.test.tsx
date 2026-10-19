import { act, render, screen, waitFor } from "@testing-library/react";
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { SyncStatus, syncText, syncView } from "@/components/shell/sync-status";

describe("syncView", () => {
  it("online sem nada esperando: não mostra nada", () => {
    expect(syncView({ online: true, pending: 0, stalled: 0 })).toEqual({ kind: "idle" });
    // Gravação rápida em andamento com rede não acende o indicador.
    expect(syncView({ online: true, pending: 1, stalled: 0 })).toEqual({ kind: "idle" });
  });

  it("offline: mostra o estado e quantas gravações faltam", () => {
    expect(syncText(syncView({ online: false, pending: 0, stalled: 0 }))).toBe("Offline");
    expect(syncText(syncView({ online: false, pending: 1, stalled: 1 }))).toBe("Offline · 1 pendente");
    expect(syncText(syncView({ online: false, pending: 3, stalled: 3 }))).toBe("Offline · 3 pendentes");
  });

  it("de volta online com pendências: sincronizando", () => {
    expect(syncText(syncView({ online: true, pending: 2, stalled: 2 }))).toBe("Sincronizando · 2 pendentes");
  });
});

describe("SyncStatus", () => {
  afterEach(() => onlineManager.setOnline(true));

  function setup() {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <SyncStatus />
      </QueryClientProvider>,
    );
    return client;
  }

  it("é uma região aria-live que mostra offline e N pendentes com texto", async () => {
    const client = setup();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();

    act(() => onlineManager.setOnline(false));
    await waitFor(() => expect(status).toHaveTextContent("Offline"));

    // Sem rede, a gravação fica pausada à espera da conexão.
    await act(async () => {
      for (let i = 0; i < 2; i++) {
        void client
          .getMutationCache()
          .build(client, { mutationFn: () => new Promise<void>(() => {}) })
          .execute(undefined);
      }
    });
    await waitFor(() => expect(status).toHaveTextContent("Offline · 2 pendentes"));
    expect(status).toHaveAttribute("data-state", "offline");

    // A rede volta: a fila é retomada e o indicador apaga quando nada mais espera.
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(status).toBeEmptyDOMElement());
  });
});
