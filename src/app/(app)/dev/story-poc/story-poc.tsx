"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import { Button } from "@/components/ui/button";

const STORY_W = 1080;
const STORY_H = 1920;
const PREVIEW_SCALE = 0.25;

type Result = { ms: number; width: number; height: number; shared: boolean } | { error: string };

export function StoryPoc() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportStory() {
    const node = frameRef.current;
    if (!node) return;
    setBusy(true);
    const started = performance.now();
    try {
      await document.fonts.ready;
      const options = { width: STORY_W, height: STORY_H, pixelRatio: 1, style: { transform: "none" } };
      // Captura de aquecimento: no Safari a primeira costuma sair sem fontes/imagens.
      await toPng(node, options);
      const dataUrl = await toPng(node, options);

      const blob = await (await fetch(dataUrl)).blob();
      const size = await imageSize(dataUrl);
      const file = new File([blob], "bctrl-story-poc.png", { type: "image/png" });

      let shared = false;
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Bctrl Hub" });
          shared = true;
        } catch (e) {
          if ((e as Error).name !== "AbortError") throw e;
        }
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = file.name;
        a.click();
      }
      setResult({ ms: Math.round(performance.now() - started), ...size, shared });
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div
        className="overflow-hidden rounded-xl border"
        style={{ width: STORY_W * PREVIEW_SCALE, height: STORY_H * PREVIEW_SCALE }}
      >
        <div
          ref={frameRef}
          style={{ width: STORY_W, height: STORY_H, transform: `scale(${PREVIEW_SCALE})`, transformOrigin: "top left" }}
          className="relative flex flex-col justify-between bg-brand-ink p-24 text-brand-paper"
        >
          <div className="flex items-center gap-6">
            <BrandSymbol className="size-28 text-brand-paper" />
            <BrandWordmark className="text-7xl" />
          </div>
          <div>
            <p className="font-mono text-4xl tracking-[0.3em] text-brand-orange uppercase">Upper 1 · POC</p>
            <p className="mt-6 font-mono text-[220px] leading-none font-semibold tabular-nums">12.480</p>
            <p className="mt-4 text-5xl font-bold">kg de volume total</p>
          </div>
          <p className="font-mono text-3xl tracking-[0.3em] uppercase opacity-70">Be in control.</p>
        </div>
      </div>

      <div className="max-w-sm space-y-4 text-sm">
        <p className="text-muted-foreground">
          Gera um PNG {STORY_W}×{STORY_H}. No celular abre o menu de compartilhar; no computador, baixa o arquivo.
          Confira se as fontes Sora e IBM Plex Mono aparecem iguais à prévia.
        </p>
        <Button onClick={exportStory} disabled={busy} className="h-12 w-full">
          {busy ? "Gerando…" : "Gerar e compartilhar PNG"}
        </Button>
        {result && (
          <pre data-testid="poc-result" className="num rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function imageSize(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}
