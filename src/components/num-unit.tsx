import { cn } from "@/lib/utils";

/**
 * Número + unidade ("42,5 kg"): o número em mono tabular (`num`) e a unidade, com o espaço,
 * na fonte do texto. Na IBM Plex Mono o espaço ocupa um caractere inteiro e parecia duplo
 * ("42,5  kg"). O texto continua "42,5 kg" para leitores de tela e para copiar.
 */
export function NumUnit({
  value,
  unit,
  className,
  unitClassName,
}: {
  value: string;
  unit: string;
  className?: string;
  unitClassName?: string;
}) {
  return (
    <span className={cn("num whitespace-nowrap", className)}>
      {value}
      <span className={cn("font-sans", unitClassName)}> {unit}</span>
    </span>
  );
}
