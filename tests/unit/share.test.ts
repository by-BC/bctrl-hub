import { beforeEach, describe, expect, it, vi } from "vitest";

const toPng = vi.hoisted(() => vi.fn());
vi.mock("html-to-image", () => ({ toPng }));

import { STORY_HEIGHT, STORY_WIDTH, dataUrlToBlob, exportStory, shareOrDownload, type ShareEnv } from "@/features/story/export";

// PNG 1×1 transparente.
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("exportStory", () => {
  beforeEach(() => {
    toPng.mockReset();
    toPng.mockResolvedValue(PNG_1X1);
  });

  it("espera as fontes, faz a captura de aquecimento e devolve a segunda, em 1080×1920 com pixelRatio 1", async () => {
    const order: string[] = [];
    let releaseFonts!: () => void;
    const ready = new Promise<void>((r) => (releaseFonts = r)).then(() => void order.push("fonts"));
    Object.defineProperty(document, "fonts", { value: { ready }, configurable: true });
    toPng.mockImplementation(async () => {
      order.push("toPng");
      return PNG_1X1;
    });

    const node = document.createElement("div");
    const pending = exportStory(node);
    await Promise.resolve();
    expect(toPng).not.toHaveBeenCalled(); // ainda esperando as fontes
    releaseFonts();
    const blob = await pending;

    expect(order).toEqual(["fonts", "toPng", "toPng"]);
    expect(toPng).toHaveBeenCalledTimes(2);
    for (const [target, options] of toPng.mock.calls) {
      expect(target).toBe(node);
      expect(options).toMatchObject({
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        canvasWidth: STORY_WIDTH,
        canvasHeight: STORY_HEIGHT,
        pixelRatio: 1,
        style: { transform: "none" },
      });
    }
    expect(STORY_WIDTH).toBe(1080);
    expect(STORY_HEIGHT).toBe(1920);
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("as guias de área segura (modo dev) ficam fora da imagem", async () => {
    await exportStory(document.createElement("div"));
    const { filter } = toPng.mock.calls[0][1] as { filter: (n: HTMLElement) => boolean };
    const guide = document.createElement("div");
    guide.dataset.storyGuide = "";
    expect(filter(guide)).toBe(false);
    expect(filter(document.createElement("p"))).toBe(true);
  });

  it("propaga a falha da captura", async () => {
    toPng.mockRejectedValueOnce(new Error("canvas"));
    await expect(exportStory(document.createElement("div"))).rejects.toThrow("canvas");
  });
});

describe("dataUrlToBlob", () => {
  it("decodifica base64 com o tipo certo", async () => {
    const blob = dataUrlToBlob(PNG_1X1);
    expect(blob.type).toBe("image/png");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    // Assinatura PNG: 89 50 4E 47.
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
});

function env(nav: Partial<ShareEnv["navigator"]>) {
  const anchors: HTMLAnchorElement[] = [];
  const doc = document;
  const realCreate = doc.createElement.bind(doc);
  vi.spyOn(doc, "createElement").mockImplementation(((tag: string) => {
    const el = realCreate(tag);
    if (tag === "a") {
      el.click = vi.fn();
      anchors.push(el as HTMLAnchorElement);
    }
    return el;
  }) as typeof doc.createElement);
  const url = { createObjectURL: vi.fn(() => "blob:story"), revokeObjectURL: vi.fn() };
  return { anchors, url, env: { navigator: nav as ShareEnv["navigator"], document: doc, url } satisfies ShareEnv };
}

describe("shareOrDownload", () => {
  const blob = new Blob(["png"], { type: "image/png" });

  beforeEach(() => vi.restoreAllMocks());

  it("com Web Share de arquivos: abre o menu nativo com o PNG", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const { env: e, anchors } = env({ share, canShare });

    await expect(shareOrDownload(blob, "story.png", e)).resolves.toBe("shared");

    const file = canShare.mock.calls[0][0].files[0] as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("story.png");
    expect(file.type).toBe("image/png");
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file] }));
    expect(anchors).toHaveLength(0);
  });

  it("sem canShare (desktop): baixa o PNG", async () => {
    const share = vi.fn();
    const { env: e, anchors, url } = env({ share, canShare: undefined });

    await expect(shareOrDownload(blob, "story.png", e)).resolves.toBe("downloaded");

    expect(share).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(1);
    expect(anchors[0].download).toBe("story.png");
    expect(anchors[0].href).toBe("blob:story");
    expect(anchors[0].click).toHaveBeenCalled();
    expect(url.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it("canShare recusa arquivos: baixa o PNG", async () => {
    const share = vi.fn();
    const { env: e, anchors } = env({ share, canShare: vi.fn().mockReturnValue(false) });
    await expect(shareOrDownload(blob, "story.png", e)).resolves.toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(1);
  });

  it("usuário cancela o menu (AbortError): não é erro e não baixa", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError"));
    const { env: e, anchors } = env({ share, canShare: () => true });
    await expect(shareOrDownload(blob, "story.png", e)).resolves.toBe("cancelled");
    expect(anchors).toHaveLength(0);
  });

  it("share recusado pelo navegador (ex.: NotAllowedError): cai no download", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("sem gesto", "NotAllowedError"));
    const { env: e, anchors } = env({ share, canShare: () => true });
    await expect(shareOrDownload(blob, "story.png", e)).resolves.toBe("downloaded");
    expect(anchors).toHaveLength(1);
  });
});
