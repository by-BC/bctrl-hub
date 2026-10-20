"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { BrandSymbol } from "@/components/brand/brand-symbol";

/**
 * Mídia do exercício exibida por link (CDN do Hevy), sem cópia: RF02.
 * - Miniatura: `<img loading="lazy">`.
 * - Vídeo: só no detalhe, `muted loop playsInline preload="none"`. Toca sozinho, exceto com
 *   `prefers-reduced-motion`, e tem botão de pausar/reproduzir.
 * - Qualquer falha de carga cai no placeholder com o símbolo Bctrl e o grupo muscular.
 */

type MediaSource = {
  name: string;
  muscleGroup: string | null;
  thumbnailUrl: string | null;
};

/** Placeholder: símbolo da marca + grupo muscular (texto, não só imagem). */
export function MediaPlaceholder({
  muscleGroup,
  compact = false,
  className,
}: {
  muscleGroup: string | null;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      data-testid="media-placeholder"
      className={cn(
        "flex size-full flex-col items-center justify-center gap-2 bg-muted text-muted-foreground",
        className,
      )}
    >
      <BrandSymbol aria-hidden title="" className={compact ? "size-6" : "size-16"} />
      {compact ? (
        <span className="sr-only">{muscleGroup ?? "Sem imagem"}</span>
      ) : (
        <span className="px-3 text-center text-sm font-medium">{muscleGroup ?? "Sem imagem"}</span>
      )}
    </span>
  );
}

/** Miniatura quadrada da lista (48 px). Decorativa: o nome já está na linha. */
export function ExerciseThumb({ muscleGroup, thumbnailUrl, className }: Omit<MediaSource, "name"> & { className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cn("block size-12 shrink-0 overflow-hidden rounded-lg border bg-muted", className)} aria-hidden>
      {thumbnailUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- mídia por link do CDN do Hevy (sem otimizador nem cópia)
        <img
          src={thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          width={48}
          height={48}
          data-testid="exercise-thumb"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <MediaPlaceholder muscleGroup={muscleGroup} compact />
      )}
    </span>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** `play()` sempre como promessa (navegadores antigos e o jsdom não devolvem uma). */
const play = (video: HTMLVideoElement) => Promise.resolve().then(() => video.play());

/** Mídia grande do detalhe: vídeo (se houver), senão a miniatura, senão o placeholder. */
export function ExerciseMedia({
  name,
  muscleGroup,
  thumbnailUrl,
  mediaUrl,
  className,
}: MediaSource & { mediaUrl: string | null; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  const hasVideo = !!mediaUrl && !videoFailed;
  const hasThumb = !!thumbnailUrl && !thumbFailed;

  // Começa a tocar ao abrir o detalhe (preload="none": nada é baixado antes disso).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion()) return;
    // Autoplay recusado ou mídia indisponível: fica a miniatura e o botão de reproduzir.
    play(video).catch(() => {});
  }, [mediaUrl]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) play(video).catch(() => setVideoFailed(true));
    else video.pause();
  }

  return (
    <figure
      className={cn("relative aspect-square w-full overflow-hidden rounded-xl border bg-muted", className)}
      aria-label={`Demonstração: ${name}`}
    >
      {hasVideo && (
        <video
          ref={videoRef}
          src={mediaUrl}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          data-testid="exercise-video"
          onPlaying={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            setVideoFailed(true);
          }}
          className="absolute inset-0 size-full object-contain"
        />
      )}

      {/* Enquanto o vídeo não toca (ou sem vídeo): miniatura ou placeholder por cima. */}
      {!playing && (
        <div className="absolute inset-0">
          {hasThumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- mídia por link do CDN do Hevy (sem otimizador nem cópia)
            <img
              src={thumbnailUrl}
              alt=""
              loading="lazy"
              decoding="async"
              data-testid="exercise-image"
              onError={() => setThumbFailed(true)}
              className="size-full object-contain"
            />
          ) : (
            <MediaPlaceholder muscleGroup={muscleGroup} />
          )}
        </div>
      )}

      {hasVideo && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pausar demonstração" : "Reproduzir demonstração"}
          className="absolute right-2 bottom-2 flex size-11 items-center justify-center rounded-full border bg-card/90 text-foreground shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {playing ? <Pause aria-hidden className="size-5" /> : <Play aria-hidden className="size-5" />}
        </button>
      )}
    </figure>
  );
}
