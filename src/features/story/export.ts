import { toPng } from "html-to-image";

/**
 * Exportação do story no navegador (a foto nunca sai do aparelho).
 *
 * Aprendizados da POC 1.10 (validados no Chromium e no iPhone): esperar
 * `document.fonts.ready`, fazer uma captura de aquecimento descartada (no Safari a
 * primeira costuma sair sem fontes/imagens) e fixar `pixelRatio: 1` para o PNG sair
 * com exatamente 1080×1920 em qualquer tela.
 */

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
/** Faixas do topo e da base cobertas pela interface do Instagram. */
export const STORY_SAFE_INSET = 250;

/** Guias de área segura (só no modo dev) nunca entram na imagem. */
const notGuide = (node: HTMLElement) => !(node.dataset && "storyGuide" in node.dataset);

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",", 2);
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Captura o nó do story (1080×1920) como PNG. */
export async function exportStory(node: HTMLElement): Promise<Blob> {
  await document.fonts?.ready;
  const options = {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    canvasWidth: STORY_WIDTH,
    canvasHeight: STORY_HEIGHT,
    pixelRatio: 1,
    // A prévia é escalada por CSS; a captura sai no tamanho real.
    style: { transform: "none" },
    filter: notGuide,
  };
  await toPng(node, options); // aquecimento, descartado
  return dataUrlToBlob(await toPng(node, options));
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export type ShareEnv = {
  navigator: Pick<Navigator, "share"> & { canShare?: Navigator["canShare"] };
  document: Document;
  url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;
};

const browserEnv = (): ShareEnv => ({ navigator, document, url: URL });

function download(blob: Blob, filename: string, env: ShareEnv) {
  const href = env.url.createObjectURL(blob);
  const a = env.document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  // Dá tempo de o navegador começar o download antes de liberar a memória.
  setTimeout(() => env.url.revokeObjectURL(href), 60_000);
}

/** Baixa o PNG diretamente, sem abrir o menu de compartilhamento do navegador. */
export function downloadStory(blob: Blob, filename: string) {
  download(blob, filename, browserEnv());
}

/**
 * Menu nativo de compartilhar (Instagram incluso, quando o sistema oferece) se o
 * navegador aceitar arquivos; senão, download do PNG. Fechar o menu não é erro.
 */
export async function shareOrDownload(blob: Blob, filename: string, env: ShareEnv = browserEnv()): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const data: ShareData = { files: [file] };
  if (typeof env.navigator.canShare === "function" && env.navigator.canShare(data)) {
    try {
      await env.navigator.share(data);
      return "shared";
    } catch (error) {
      // DOMException nem sempre é `instanceof Error` (outro realm): confere pelo nome.
      if ((error as { name?: unknown } | null)?.name === "AbortError") return "cancelled";
      // Ex.: NotAllowedError quando o gesto do usuário expirou durante a captura.
    }
  }
  download(blob, filename, env);
  return "downloaded";
}
