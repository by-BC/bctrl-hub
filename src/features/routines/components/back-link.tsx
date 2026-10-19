import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/** Voltar para /treino (alvo de 44 px). */
export function BackLink() {
  return (
    <Link
      href="/treino"
      className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Treino
    </Link>
  );
}
