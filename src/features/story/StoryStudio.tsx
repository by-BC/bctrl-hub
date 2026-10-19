"use client";

import { ChevronLeft, ChevronRight, Download, ImagePlus, LoaderCircle, Share2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { usePrefersReducedMotion } from "@/components/shell/hex-progress";
import { Button } from "@/components/ui/button";
import type { StoryData } from "@/lib/domain/story";
import { cn } from "@/lib/utils";
import { STORY_HEIGHT, STORY_WIDTH, exportStory, shareOrDownload } from "./export";
import { STORY_LAYOUTS } from "./layouts";
import { loadPhoto } from "./photo";
import { StoryFrame } from "./StoryFrame";
import type { StoryPhoto } from "./types";

/**
 * Story Studio: os 4 layouts num carrossel (deslize com o dedo, botões, ou setas do
 * teclado), cada um em 1080×1920 dentro de uma prévia escalada para caber na tela. O
 * botão exporta o layout visível e abre o menu nativo de compartilhar (ou baixa o PNG).
 */

const COUNT = STORY_LAYOUTS.length;
const clampIndex = (i: number) => Math.min(COUNT - 1, Math.max(0, i));

const noop = () => () => {};
/** Web Share disponível (rótulo do botão). No servidor, `false`. */
function useCanShare() {
  return useSyncExternalStore(noop, () => typeof navigator.canShare === "function", () => false);
}

/** Escala da prévia: cabe na largura do carrossel e em ~56% da altura da janela. */
function usePreviewScale(ref: React.RefObject<HTMLElement | null>) {
  const [scale, setScale] = useState(0.22);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const maxH = Math.min(760, Math.max(320, window.innerHeight * 0.56));
      const next = Math.min((el.clientWidth - 16) / STORY_WIDTH, maxH / STORY_HEIGHT);
      setScale(Math.max(0.12, Math.floor(next * 1000) / 1000));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref]);
  return scale;
}

export function StoryStudio({ data }: { data: StoryData }) {
  const [index, setIndex] = useState(0);
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Enquanto o carrossel rola até um layout escolhido por botão, ignora os índices intermediários.
  const targetRef = useRef<number | null>(null);
  const targetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const indexRef = useRef(0);
  const scale = usePreviewScale(scrollerRef);
  const canShare = useCanShare();
  const reduced = usePrefersReducedMotion();
  const layout = STORY_LAYOUTS[index];

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Ao mudar a escala (giro da tela, janela), mantém o layout atual no lugar.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = indexRef.current * el.clientWidth;
  }, [scale]);

  useEffect(() => () => clearTimeout(targetTimer.current), []);

  const go = useCallback(
    (next: number) => {
      const el = scrollerRef.current;
      const i = clampIndex(next);
      setIndex(i);
      if (!el) return;
      targetRef.current = i;
      clearTimeout(targetTimer.current);
      targetTimer.current = setTimeout(() => (targetRef.current = null), 900);
      el.scrollTo({ left: i * el.clientWidth, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = clampIndex(Math.round(el.scrollLeft / el.clientWidth));
    if (targetRef.current !== null) {
      if (i === targetRef.current) targetRef.current = null;
      return;
    }
    if (i !== indexRef.current) setIndex(i);
  }

  function onKeyDown(e: KeyboardEvent) {
    const keys: Record<string, number> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: COUNT - 1 };
    if (e.key in keys) {
      e.preventDefault();
      go(keys[e.key]);
    }
  }

  async function onExport() {
    const node = frameRefs.current[index];
    if (!node || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(node);
      const outcome = await shareOrDownload(blob, `bctrl-story-${data.date}-${layout.id}.png`);
      if (outcome === "downloaded") toast.success("Story baixado (PNG 1080×1920).");
    } catch (error) {
      console.error("[bctrl]", "Falha ao gerar o story.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  const missingPhoto = !!layout.needsPhoto && !photo;

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <div className="min-w-0 lg:w-[460px] lg:shrink-0">
        <div
          ref={scrollerRef}
          role="region"
          aria-roledescription="carrossel"
          aria-label="Layouts do story"
          tabIndex={0}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          data-testid="story-carousel"
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl outline-none [scrollbar-width:none] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden"
        >
          {STORY_LAYOUTS.map((l, i) => (
            <div
              key={l.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${l.name}, ${i + 1} de ${COUNT}`}
              aria-hidden={i !== index}
              data-layout={l.id}
              className="flex w-full shrink-0 snap-center snap-always justify-center py-2"
            >
              <div
                className="relative overflow-hidden rounded-xl shadow-lg ring-1 ring-border"
                style={{ width: Math.round(STORY_WIDTH * scale), height: Math.round(STORY_HEIGHT * scale) }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                  <StoryFrame
                    tone={l.tone}
                    ref={(el) => {
                      frameRefs.current[i] = el;
                    }}
                  >
                    <l.Component data={data} photo={photo} />
                  </StoryFrame>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Layout anterior"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <div role="group" aria-label="Escolher layout" className="flex flex-wrap justify-center gap-1">
            {STORY_LAYOUTS.map((l, i) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={i === index}
                onClick={() => go(i)}
                className={cn(
                  "min-h-11 rounded-full px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  i === index ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {l.name}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Próximo layout"
            disabled={index === COUNT - 1}
            onClick={() => go(index + 1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-sm lg:pt-2">
        <div aria-live="polite">
          <h2 className="text-lg font-semibold" data-testid="story-layout-name">
            {layout.name}
            <span className="num ml-2 text-sm font-normal text-muted-foreground">
              {index + 1}/{COUNT}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">{layout.description}</p>
        </div>

        {layout.needsPhoto && <PhotoControls photo={photo} onChange={setPhoto} />}

        <div className="space-y-2">
          <Button className="h-12 w-full text-base font-semibold" disabled={busy || missingPhoto} onClick={onExport}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : canShare ? <Share2 aria-hidden /> : <Download aria-hidden />}
            {busy ? "Gerando…" : canShare ? "Compartilhar" : "Baixar PNG"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {missingPhoto
              ? "Escolha uma foto para este layout."
              : canShare
                ? "Abre o menu do celular: escolha Instagram › Story. A imagem é gerada aqui, sem envio."
                : "Baixa um PNG 1080×1920 pronto para o story. A imagem é gerada aqui, sem envio."}
          </p>
        </div>
      </div>
    </div>
  );
}

function PhotoControls({ photo, onChange }: { photo: StoryPhoto | null; onChange: (p: StoryPhoto | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    try {
      const src = await loadPhoto(file);
      onChange({ src, zoom: 1, x: 50, y: 50 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a foto.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const slider =
    "h-11 w-full cursor-pointer accent-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-md";

  return (
    <fieldset className="space-y-3 rounded-xl border p-4" data-testid="story-photo-controls">
      <legend className="px-1 text-sm font-semibold">Foto</legend>
      {/* Sem `capture`: o celular oferece câmera e galeria. O arquivo é lido só no aparelho. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        aria-label="Foto do story"
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11" disabled={loading} onClick={() => inputRef.current?.click()}>
          {loading ? <LoaderCircle aria-hidden className="animate-spin" /> : <ImagePlus aria-hidden />}
          {photo ? "Trocar foto" : "Escolher foto"}
        </Button>
        {photo && (
          <Button variant="ghost" className="h-11" onClick={() => onChange(null)}>
            <Trash2 aria-hidden />
            Remover
          </Button>
        )}
      </div>
      {photo && (
        <div className="space-y-1 text-sm">
          <label className="block">
            <span className="flex justify-between">
              Zoom <span className="num text-muted-foreground">{Math.round(photo.zoom * 100)}%</span>
            </span>
            <input
              type="range"
              min={100}
              max={200}
              step={5}
              value={Math.round(photo.zoom * 100)}
              onChange={(e) => onChange({ ...photo, zoom: Number(e.target.value) / 100 })}
              className={slider}
            />
          </label>
          <label className="block">
            <span>Posição horizontal</span>
            <input
              type="range"
              min={0}
              max={100}
              value={photo.x}
              onChange={(e) => onChange({ ...photo, x: Number(e.target.value) })}
              className={slider}
            />
          </label>
          <label className="block">
            <span>Posição vertical</span>
            <input
              type="range"
              min={0}
              max={100}
              value={photo.y}
              onChange={(e) => onChange({ ...photo, y: Number(e.target.value) })}
              className={slider}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
