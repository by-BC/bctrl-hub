"use client";

import { ArrowLeft, Download, LoaderCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAchievements, useDailyScores, useMonthNumbers } from "@/features/profile/hooks";
import { useToday } from "@/features/progress/use-today";
import { buildMonthCardData, parseMonthParam, type MonthCardData } from "@/lib/domain/month-card";
import { monthLabel } from "@/lib/domain/month-view";
import { monthEnd, monthStart } from "@/lib/domain/week";
import { STORY_HEIGHT, STORY_WIDTH, exportStory, shareOrDownload } from "./export";
import { MonthCard } from "./layouts/MonthCard";
import { StoryFrame } from "./StoryFrame";
import { useCanShare, usePreviewScale } from "./StoryStudio";

function BackLink() {
  return (
    <Link
      href="/perfil"
      className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Perfil
    </Link>
  );
}

/**
 * Conteúdo de /perfil/mes/[month]/story (`month` = "AAAA-MM"): carrega o resumo do mês, a
 * pontuação de cada dia e as conquistas, e mostra o card do mês pronto para compartilhar.
 */
export function MonthStoryScreen({ month: param }: { month: string }) {
  const today = useToday();
  const parsed = parseMonthParam(param);
  // Mês futuro não tem card (o resumo do Perfil também não passa do mês de hoje).
  const month = parsed && today && parsed <= monthStart(today) ? parsed : null;
  const end = month && today ? (monthEnd(month) < today ? monthEnd(month) : today) : null;

  const summary = useMonthNumbers(month);
  const scores = useDailyScores(month, end);
  const history = useAchievements();

  const data = useMemo(
    (): MonthCardData | null =>
      summary.data && scores.data && history.achievements && today
        ? buildMonthCardData({ summary: summary.data.current, scores: scores.data, achievements: history.achievements, today })
        : null,
    [summary.data, scores.data, history.achievements, today],
  );

  if (!today) return <MonthStorySkeleton />;
  if (!month) {
    return (
      <>
        <BackLink />
        <PageHeader title="Mês não encontrado" />
        <p className="text-sm text-muted-foreground">Escolha um mês até o de hoje no resumo do Perfil.</p>
      </>
    );
  }
  if (summary.isError || scores.isError || history.isError) {
    return (
      <>
        <BackLink />
        <PageHeader title="Compartilhar mês" />
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o resumo do mês.</p>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              if (summary.isError) summary.refetch();
              if (scores.isError) scores.refetch();
              if (history.isError) history.refetch();
            }}
          >
            Tentar de novo
          </Button>
        </div>
      </>
    );
  }
  if (!data) return <MonthStorySkeleton />;

  return (
    <>
      <BackLink />
      <PageHeader title="Compartilhar mês" eyebrow={monthLabel(data.month)} />
      <MonthStudio data={data} />
    </>
  );
}

/** Prévia escalada do card (1080×1920) e o botão que exporta e compartilha (ou baixa). */
function MonthStudio({ data }: { data: MonthCardData }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const scale = usePreviewScale(boxRef);
  const canShare = useCanShare();

  async function onExport() {
    const node = frameRef.current;
    if (!node || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(node);
      const outcome = await shareOrDownload(blob, `bctrl-mes-${data.key}.png`);
      if (outcome === "downloaded") toast.success("Card do mês baixado (PNG 1080×1920).");
    } catch (error) {
      console.error("[bctrl]", "Falha ao gerar o card do mês.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
      <div ref={boxRef} className="min-w-0 lg:w-[460px] lg:shrink-0">
        <figure
          aria-label={`Card de ${monthLabel(data.month)}`}
          data-testid="month-card-preview"
          className="mx-auto overflow-hidden rounded-xl shadow-lg ring-1 ring-border"
          style={{ width: Math.round(STORY_WIDTH * scale), height: Math.round(STORY_HEIGHT * scale) }}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <StoryFrame tone="ink" ref={frameRef}>
              <MonthCard data={data} />
            </StoryFrame>
          </div>
        </figure>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-sm lg:pt-2">
        <div>
          <h2 className="text-lg font-semibold">Card do mês</h2>
          <p className="text-sm text-muted-foreground">
            Calendário de dias no controle, números do mês e conquistas, no formato do story.
          </p>
        </div>
        <div className="space-y-2">
          <Button className="h-12 w-full text-base font-semibold" disabled={busy} onClick={onExport}>
            {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : canShare ? <Share2 aria-hidden /> : <Download aria-hidden />}
            {busy ? "Gerando…" : canShare ? "Compartilhar" : "Baixar PNG"}
          </Button>
          <p className="text-xs text-muted-foreground">
            {canShare
              ? "Abre o menu do celular: escolha Instagram › Story. A imagem é gerada aqui, sem envio."
              : "Baixa um PNG 1080×1920 pronto para o story. A imagem é gerada aqui, sem envio."}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MonthStorySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando o card do mês">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="aspect-[9/16] w-full max-w-[260px] rounded-xl" />
    </div>
  );
}
