"use client";

import { ArrowLeft, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkoutDetail } from "@/features/history/hooks";
import { useWeekSummary } from "@/features/week/hooks";
import { weekStart } from "@/lib/domain/week";
import { formatDay } from "@/lib/format";
import { StoryFrame } from "./StoryFrame";
import { exportStory, shareOrDownload, STORY_HEIGHT, STORY_WIDTH } from "./export";
import { storyDataFrom } from "./data";
import { useCanShare, usePreviewScale } from "./StoryStudio";

const uuid = z.guid();
const models = ["Resumo da sessão", "Destaques"] as const;

export function WorkoutStoryScreen({ id }: { id: string }) {
  const validId = uuid.safeParse(id).success;
  const detail = useWorkoutDetail(id, validId);
  const workout = validId ? detail.data : null;
  const week = useWeekSummary(workout ? weekStart(workout.day) : null);

  if (validId && (detail.isPending || (workout && week.isPending))) {
    return <div className="space-y-4" aria-busy="true" aria-label="Carregando story"><Skeleton className="h-10 w-48" /><Skeleton className="aspect-[9/16] w-full max-w-[260px] rounded-xl" /></div>;
  }
  if (!workout) {
    return <div role="alert" className="space-y-3"><p>Não foi possível encontrar este treino salvo.</p><Button asChild variant="outline"><Link href="/treino/historico">Voltar ao histórico</Link></Button></div>;
  }

  return <WorkoutStoryStudio data={storyDataFrom(workout, week.data ?? null)} workoutId={workout.id} />;
}

function WorkoutStoryStudio({ data, workoutId }: { data: ReturnType<typeof storyDataFrom>; workoutId: string }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scale = usePreviewScale(previewRef);
  const canShare = useCanShare();
  const date = useMemo(() => formatDay(data.date), [data.date]);

  async function share() {
    if (!frameRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(frameRef.current);
      const outcome = await shareOrDownload(blob, `bctrl-treino-${data.date}-${index + 1}.png`);
      if (outcome === "downloaded") toast.success("Story baixado (PNG 1080×1920).");
    } catch (error) {
      console.error("[bctrl]", "Falha ao gerar o story do treino.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link href={`/treino/historico/${workoutId}`} className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ArrowLeft aria-hidden className="size-4" /> Voltar ao treino
      </Link>
      <PageHeader title="Story do treino" eyebrow="Treino" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-10">
        <div ref={previewRef} className="min-w-0 lg:w-[460px] lg:shrink-0">
          <div className="flex justify-center py-2">
            <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-border" style={{ width: Math.round(STORY_WIDTH * scale), height: Math.round(STORY_HEIGHT * scale) }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <StoryFrame tone={index === 0 ? "ink" : "paper"} ref={frameRef}>
                  {index === 0 ? <SessionSummary data={data} date={date} /> : <SessionHighlights data={data} date={date} />}
                </StoryFrame>
              </div>
            </div>
          </div>
          <div role="group" aria-label="Modelos de story do treino" className="mt-3 flex justify-center gap-2">
            {models.map((model, i) => <Button key={model} variant={index === i ? "default" : "outline"} className="min-h-11" aria-pressed={index === i} onClick={() => setIndex(i)}>{model}</Button>)}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-sm lg:pt-2">
          <p className="text-sm text-muted-foreground">Modelos feitos para compartilhar a sessão concluída.</p>
          <Button className="h-12 w-full text-base font-semibold" disabled={busy} onClick={share}>
            {canShare ? <Share2 aria-hidden /> : <Download aria-hidden />}{busy ? "Gerando…" : canShare ? "Compartilhar" : "Baixar PNG"}
          </Button>
          <p className="text-xs text-muted-foreground">A imagem é gerada neste aparelho em 1080×1920.</p>
        </div>
      </div>
    </>
  );
}

function SessionSummary({ data, date }: { data: ReturnType<typeof storyDataFrom>; date: string }) {
  return (
    <div className="flex h-full flex-col justify-center px-[88px] text-white">
      <p className="text-[30px] font-semibold uppercase tracking-[.24em] text-white/60">Treino concluído</p>
      <h2 className="mt-5 text-[82px] font-black leading-[.98]">{data.routineName}</h2>
      <p className="mt-6 text-[36px] text-white/70">{date}</p>
      <div className="mt-20 grid grid-cols-2 gap-5">
        <Metric label="Volume" value={`${data.volumeKg.toLocaleString("pt-BR")} kg`} />
        <Metric label="Séries" value={String(data.setsCount)} />
        <Metric label="Exercícios" value={String(data.exercises.length + data.hiddenExercises)} />
        <Metric label="Recordes" value={String(data.prs.length)} />
      </div>
      <p className="mt-16 text-[27px] font-semibold tracking-[.16em] text-white/45">BCTRL · FEITO</p>
    </div>
  );
}

function SessionHighlights({ data, date }: { data: ReturnType<typeof storyDataFrom>; date: string }) {
  return (
    <div className="flex h-full flex-col justify-center px-[88px] text-brand-ink">
      <p className="text-[30px] font-semibold uppercase tracking-[.24em] text-brand-blue">Meu treino · {date}</p>
      <h2 className="mt-5 text-[76px] font-black leading-[.98]">Destaques</h2>
      <p className="mt-5 text-[42px] font-semibold">{data.routineName}</p>
      {data.prs.length > 0 ? (
        <div className="mt-14 space-y-6">
          {data.prs.slice(0, 4).map((pr, i) => <div key={`${pr.exercise}-${pr.kind}-${i}`} className="border-t-2 border-brand-ink/15 pt-5"><p className="text-[31px] font-bold">{pr.exercise}</p><p className="mt-2 text-[26px] text-brand-ink/65">Novo recorde · {pr.kg} kg × {pr.reps}</p></div>)}
        </div>
      ) : (
        <div className="mt-14 space-y-6">{data.exercises.slice(0, 4).map((exercise) => <div key={exercise.name} className="border-t-2 border-brand-ink/15 pt-5"><p className="text-[31px] font-bold">{exercise.name}</p><p className="mt-2 text-[26px] text-brand-ink/65">Melhor série · {exercise.best.kg} kg × {exercise.best.reps}</p></div>)}</div>
      )}
      <p className="mt-16 text-[27px] font-semibold tracking-[.16em] text-brand-ink/45">BCTRL · CONSISTÊNCIA</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[28px] border-2 border-white/15 bg-white/5 p-7"><p className="text-[25px] font-medium text-white/55">{label}</p><p className="mt-2 text-[47px] font-black">{value}</p></div>;
}
