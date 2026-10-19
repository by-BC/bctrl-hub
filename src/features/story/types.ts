import type { FC } from "react";
import type { StoryData } from "@/lib/domain/story";

export type { StoryData };

/** Foto de fundo do layout Foto + overlay: dataURL local + enquadramento. */
export type StoryPhoto = {
  /** dataURL (nunca uma URL remota: a foto não sai do aparelho). */
  src: string;
  /** 1 = cobre o quadro; até 3. */
  zoom: number;
  /** Ponto focal em % (0–100). */
  x: number;
  y: number;
};

export type StoryLayoutProps = { data: StoryData; photo?: StoryPhoto | null };

/** Renderiza em 1080×1920 (dentro do `StoryFrame`). */
export type StoryLayout = FC<StoryLayoutProps>;

/** Paleta fixa do quadro: grafite, off-white ou ultramarino. */
export type StoryTone = "ink" | "paper" | "blue";

export type StoryLayoutId = "recibo" | "hex-week" | "blueprint" | "foto";

export type StoryLayoutDef = {
  id: StoryLayoutId;
  name: string;
  /** Uma linha para leitores de tela e para a legenda do carrossel. */
  description: string;
  Component: StoryLayout;
  tone: StoryTone;
  needsPhoto?: boolean;
};
