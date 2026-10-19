import type { StoryLayoutDef } from "../types";
import { Blueprint } from "./Blueprint";
import { HexWeek } from "./HexWeek";
import { PhotoOverlay } from "./PhotoOverlay";
import { Receipt } from "./Receipt";

export const STORY_LAYOUTS: readonly StoryLayoutDef[] = [
  { id: "recibo", name: "Recibo", description: "Cupom fiscal com cada série e o volume como total.", Component: Receipt, tone: "ink" },
  { id: "hex-week", name: "Hex Week", description: "O símbolo do Bctrl como anel da semana.", Component: HexWeek, tone: "ink" },
  { id: "blueprint", name: "Blueprint", description: "Prancha técnica em fundo ultramarino.", Component: Blueprint, tone: "blue" },
  {
    id: "foto",
    name: "Foto + overlay",
    description: "Sua foto de fundo com os dados numa faixa grafite e laranja.",
    Component: PhotoOverlay,
    tone: "ink",
    needsPhoto: true,
  },
];
