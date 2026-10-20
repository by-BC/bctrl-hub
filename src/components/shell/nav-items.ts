import {
  ChartLine,
  Dumbbell,
  Hexagon,
  ListChecks,
  Repeat,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece na barra inferior do celular (máx. 5). */
  mobile: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoje", icon: Hexagon, mobile: true },
  { href: "/treino", label: "Treino", icon: Dumbbell, mobile: true },
  { href: "/comida", label: "Comida", icon: UtensilsCrossed, mobile: true },
  { href: "/habitos", label: "Hábitos", icon: Repeat, mobile: true },
  { href: "/tarefas", label: "Tarefas", icon: ListChecks, mobile: true },
  { href: "/evolucao", label: "Evolução", icon: ChartLine, mobile: false },
  // No celular, o Perfil fica no cabeçalho (MobileHeader), sem tirar item da barra inferior.
  { href: "/perfil", label: "Perfil", icon: UserRound, mobile: false },
];

/** "/" só é ativo na raiz; os demais também nas sub-rotas (/treino/sessao…). */
export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
