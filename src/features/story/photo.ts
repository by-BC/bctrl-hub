import { STORY_HEIGHT, STORY_WIDTH } from "./export";

/**
 * Foto do layout Foto + overlay: lida do arquivo escolhido e convertida em dataURL no
 * próprio aparelho (nada de upload). É reduzida para o bastante para cobrir o quadro com
 * até 2× de zoom, o que deixa a captura leve no celular. O `object URL` temporário é
 * local (blob:), não gera requisição de rede, e é liberado logo depois.
 */

const MAX_ZOOM = 2;

export async function loadPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const url = URL.createObjectURL(file);
  try {
    const img = await decode(url);
    const cover = Math.max(STORY_WIDTH / img.naturalWidth, STORY_HEIGHT / img.naturalHeight) * MAX_ZOOM;
    const scale = Math.min(1, cover);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível preparar a foto.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function decode(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível abrir essa imagem."));
    img.src = src;
  });
}
