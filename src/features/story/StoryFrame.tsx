import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { STORY_HEIGHT, STORY_SAFE_INSET, STORY_WIDTH } from "./export";
import type { StoryTone } from "./types";

const TONE_CLASS: Record<StoryTone, string> = {
  ink: "story-ink bg-brand-ink",
  paper: "story-paper bg-brand-paper",
  blue: "story-blue bg-brand-blue",
};

/** Guias só no modo dev: mostram as faixas cobertas pela interface do Instagram. */
const SHOW_GUIDES = process.env.NODE_ENV === "development";

/**
 * Quadro do story em tamanho real (1080×1920). A prévia escala o quadro por fora; a
 * exportação captura este nó. A paleta vem da classe de tom (fixa, independe do tema).
 */
export function StoryFrame({
  tone,
  children,
  className,
  ref,
}: {
  tone: StoryTone;
  children: ReactNode;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      data-story-frame
      className={cn("relative isolate overflow-hidden font-sans antialiased", TONE_CLASS[tone], className)}
      style={{ width: STORY_WIDTH, height: STORY_HEIGHT }}
    >
      {children}
      {SHOW_GUIDES && <SafeAreaGuides />}
    </div>
  );
}

function SafeAreaGuides() {
  const band = "pointer-events-none absolute inset-x-0 z-50 border-dashed border-destructive bg-destructive/10";
  return (
    <>
      <div data-story-guide aria-hidden className={cn(band, "top-0 border-b-4")} style={{ height: STORY_SAFE_INSET }} />
      <div data-story-guide aria-hidden className={cn(band, "bottom-0 border-t-4")} style={{ height: STORY_SAFE_INSET }} />
    </>
  );
}
