import type { SVGProps } from "react";

/**
 * Símbolo do Bctrl Hub: hexágono em 3 segmentos (treino · alimentação ·
 * hábitos) + núcleo. Mesma geometria de assets/brand/bctrl-hub-symbol.svg.
 * O segmento neutro e o núcleo usam currentColor para seguir o tema.
 */
export function BrandSymbol({ title = "Bctrl Hub", ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={title} {...props}>
      <g fill="none" strokeWidth={22} strokeLinejoin="miter" strokeLinecap="butt">
        <polyline points="108.7,25 169.3,60 169.3,130" stroke="var(--brand-blue)" />
        <polyline points="160.6,145 100,180 39.4,145" stroke="var(--brand-orange)" />
        <polyline points="30.7,130 30.7,60 91.3,25" stroke="currentColor" />
      </g>
      <polygon points="100,78 119,89 119,111 100,122 81,111 81,89" fill="currentColor" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="font-sans font-extrabold italic tracking-tight">Bctrl</span>
      <span className="ml-1 font-mono font-medium text-highlight-text">/hub</span>
    </span>
  );
}
