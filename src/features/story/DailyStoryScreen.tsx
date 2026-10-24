"use client";

import { ArrowLeft, Download, LoaderCircle, Share2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyScores } from "@/features/profile/hooks";
import { useToday } from "@/features/progress/use-today";
import { formatDay } from "@/lib/format";
import { DailyCard } from "./DailyCard";
import { STORY_HEIGHT, STORY_WIDTH, exportStory, shareOrDownload } from "./export";
import { StoryFrame } from "./StoryFrame";
import { useCanShare, usePreviewScale } from "./StoryStudio";

export function DailyStoryScreen() {
  const today = useToday();
  const scores = useDailyScores(today, today);
  const facts = scores.data?.find((day) => day.day === today) ?? null;

  if (!today || scores.isPending) return <DailyStorySkeleton />;
  if (scores.isError) {
    return (
      <>
        <BackLink />
        <PageHeader title="Story do dia" />
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o resumo de hoje.</p>
          <Button variant="outline" className="h-11" onClick={() => scores.refetch()}>Tentar de novo</Button>
        </div>
      </>
    );
  }
  if (!facts) {
    return (
      <>
        <BackLink />
        <PageHeader title="Story do dia" />
        <p role="status" className="text-sm text-muted-foreground">Ainda não há dados de hoje para montar o story.</p>
      </>
    );
  }

  return <DailyStudio facts={facts} />;
}

function DailyStudio({ facts }: { facts: NonNullable<ReturnType<typeof useDailyScores>["data"]>[number] }) {
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
      const outcome = await shareOrDownload(blob, `bctrl-dia-${facts.day}.png`);
      if (outcome === "downloaded") toast.success("Story do dia baixado (PNG 1080×1920).");
    } catch (error) {
      console.error("[bctrl]", "Falha ao gerar o story do dia.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink />
      <PageHeader title="Story do dia" eyebrow={formatDay(facts.day)} />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div ref={boxRef} className="min-w-0 lg:w-[460px] lg:shrink-0">
          <figure aria-label={`Resumo de ${formatDay(facts.day)}`} data-testid="daily-card-preview" className="mx-auto overflow-hidden rounded-xl shadow-lg ring-1 ring-border" style={{ width: Math.round(STORY_WIDTH * scale), height: Math.round(STORY_HEIGHT * scale) }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <StoryFrame tone="ink" ref={frameRef}><DailyCard facts={facts} /></StoryFrame>
            </div>
          </figure>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5 lg:max-w-sm lg:pt-2">
          <div>
            <h2 className="text-lg font-semibold">Resumo de hoje</h2>
            <p className="text-sm text-muted-foreground">Treino, alimentação, hábitos e tarefas em uma só imagem.</p>
          </div>
          <div className="space-y-2">
            <Button className="h-12 w-full text-base font-semibold" disabled={busy} onClick={onExport}>
              {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : canShare ? <Share2 aria-hidden /> : <Download aria-hidden />}
              {busy ? "Gerando…" : canShare ? "Compartilhar" : "Baixar PNG"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {canShare ? "Abre o menu de compartilhamento do celular. A imagem é gerada aqui, sem envio." : "Baixa um PNG 1080×1920. A imagem é gerada aqui, sem envio."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function BackLink() {
  return <Link href="/perfil" className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"><ArrowLeft aria-hidden className="size-4" />Perfil</Link>;
}

function DailyStorySkeleton() {
  return <div className="space-y-4" aria-busy="true" aria-label="Carregando story do dia"><Skeleton className="h-10 w-48" /><Skeleton className="aspect-[9/16] w-full max-w-[260px] rounded-xl" /></div>;
}
