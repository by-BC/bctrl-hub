"use client";

import type { CSSProperties } from "react";
import { useSyncExternalStore } from "react";
import {
  HEX_CORE_POINTS,
  HEX_SEGMENT_KEYS,
  HEX_SEGMENT_LENGTHS,
  HEX_SEGMENT_POINTS,
  HEX_STROKE,
  HEX_VIEWBOX,
  segmentFill,
  toPct,
  type HexSegmentKey,
} from "@/lib/domain/hex";
import { cn } from "@/lib/utils";

/**
 * Hex Week: o símbolo do Bctrl Hub (mesma geometria de `BrandSymbol`) como anel de
 * progresso. Cada segmento tem um trilho discreto (a mesma cor, bem transparente) e o
 * preenchimento proporcional. Escala com o `className` (painel, story, ícone).
 *
 * Cores por token: azul = `--chart-1` (o azul da marca no claro, um passo mais claro no
 * escuro, legível sobre o fundo), laranja = `--chart-2`, neutro e núcleo = `currentColor`.
 */

export type HexSegment = {
  /** 0–1 (valores fora disso são limitados). */
  progress: number;
  /** Nome do segmento: "Treinos". */
  label: string;
  /** Número exibido: "2/4", "68%". */
  value: string;
};

export type HexSegments = Record<HexSegmentKey, HexSegment>;

export const HEX_COLORS: Record<HexSegmentKey, string> = {
  workouts: "var(--chart-1)",
  meals: "var(--chart-2)",
  habits: "currentColor",
};

const TRACK_OPACITY = 0.18;

/** "Treinos: 2/4, 50% da meta". */
export const segmentLabel = (s: HexSegment) => `${s.label}: ${s.value}, ${toPct(s.progress)}% da meta`;

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(cb: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * `true` quando o sistema pede menos movimento. No servidor (e na hidratação) assume `true`:
 * o primeiro quadro já sai preenchido e a animação só começa no cliente.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  );
}

type HexProgressProps = {
  segments: HexSegments;
  /** Nome do conjunto para leitores de tela. */
  title?: string;
  /** `false` desliga a animação (ex.: captura do story). */
  animate?: boolean;
  className?: string;
};

export function HexProgress({ segments, title = "Progresso da semana", animate = true, className }: HexProgressProps) {
  const reduced = usePrefersReducedMotion();
  const motion = animate && !reduced;

  return (
    <svg
      viewBox={`0 0 ${HEX_VIEWBOX} ${HEX_VIEWBOX}`}
      role="group"
      aria-label={title}
      data-testid="hex-progress"
      data-motion={motion ? "full" : "reduced"}
      className={cn("block", className)}
    >
      <g fill="none" strokeWidth={HEX_STROKE} strokeLinejoin="miter" strokeLinecap="butt">
        {HEX_SEGMENT_KEYS.map((key) => {
          const segment = segments[key];
          const length = HEX_SEGMENT_LENGTHS[key];
          const fill = segmentFill(segment.progress, length);
          const style: CSSProperties | undefined = motion
            ? ({
                "--hex-length": length,
                animation: "hex-fill 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                transition: "stroke-dashoffset 600ms cubic-bezier(0.22, 1, 0.36, 1)",
              } as CSSProperties)
            : undefined;
          return (
            <g
              key={key}
              role="img"
              aria-label={segmentLabel(segment)}
              data-segment={key}
              data-progress={fill.progress.toFixed(2)}
            >
              <polyline points={HEX_SEGMENT_POINTS[key]} stroke={HEX_COLORS[key]} strokeOpacity={TRACK_OPACITY} />
              <polyline
                points={HEX_SEGMENT_POINTS[key]}
                stroke={HEX_COLORS[key]}
                strokeDasharray={fill.dashArray}
                strokeDashoffset={fill.dashOffset}
                data-fill
                style={style}
              />
            </g>
          );
        })}
      </g>
      <polygon points={HEX_CORE_POINTS} fill="currentColor" aria-hidden />
    </svg>
  );
}

/** Legenda visível dos segmentos: cor + nome + número (a cor nunca vem sozinha). */
export function HexLegend({
  segments,
  details,
  className,
}: {
  segments: HexSegments;
  /** Linha extra por segmento (ex.: "3 de 21 refeições"). */
  details?: Partial<Record<HexSegmentKey, string>>;
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3", className)} data-testid="hex-legend">
      {HEX_SEGMENT_KEYS.map((key) => {
        const s = segments[key];
        return (
          <div key={key} className="min-w-0" data-segment={key}>
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-4 shrink-0 rounded-full text-foreground" style={{ background: HEX_COLORS[key] }} />
              {s.label}
            </dt>
            <dd className="num pl-6 text-lg leading-tight font-semibold">
              {s.value}
              {details?.[key] && (
                <span className="mt-0.5 block font-sans text-xs font-normal text-muted-foreground">{details[key]}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
