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
const models = ["Pôster", "Replay"] as const;

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
                <StoryFrame tone={index === 0 ? "blue" : "paper"} ref={frameRef}>
                  {index === 0 ? <SessionPoster data={data} date={date} /> : <SessionReplay data={data} date={date} />}
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

function SessionPoster({ data, date }: { data: ReturnType<typeof storyDataFrom>; date: string }) {
  const mainValue = data.volumeKg > 0 ? data.volumeKg.toLocaleString("pt-BR") : String(data.setsCount);
  const mainUnit = data.volumeKg > 0 ? "KG" : "SÉRIES";
  const exerciseCount = data.exercises.length + data.hiddenExercises;

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-[88px] pb-[270px] pt-[285px] text-brand-paper">
      <div aria-hidden className="absolute -right-[260px] top-[515px] size-[760px] rounded-full border-[3px] border-brand-paper/15" />
      <div aria-hidden className="absolute -right-[180px] top-[595px] size-[600px] rounded-full border-[3px] border-brand-paper/15" />
      <div aria-hidden className="absolute right-[102px] top-[845px] size-[110px] rounded-full bg-brand-orange" />

      <div className="relative flex items-center justify-between border-t-2 border-brand-paper/40 pt-5 text-[23px] font-bold uppercase tracking-[.2em]">
        <span>BCTRL / TRAINING LOG</span>
        <span>№ 01</span>
      </div>

      <div className="relative mt-[105px]">
        <p className="text-[30px] font-bold uppercase tracking-[.24em] text-brand-paper/65">Sessão concluída · {date}</p>
        <h2 className="mt-8 line-clamp-3 break-words text-[94px] font-black leading-[.92] tracking-[-.045em]">{data.routineName}</h2>
      </div>

      <div className="relative mt-auto flex items-end gap-5 pb-10">
        <span className="num text-[190px] font-black leading-[.78] tracking-[-.08em]">{mainValue}</span>
        <span className="pb-1 text-[38px] font-black leading-none tracking-[.1em]">{mainUnit}</span>
      </div>
      <p className="relative mb-12 max-w-[620px] text-[27px] font-semibold uppercase tracking-[.14em] text-brand-paper/75">
        {data.volumeKg > 0 ? "Volume total movimentado" : "Trabalho acumulado nesta sessão"}
      </p>

      <div className="relative flex items-end justify-between border-t-2 border-brand-paper/40 pt-6">
        <PosterStat value={`${data.durationMin}`} label="minutos" />
        <PosterStat value={`${data.setsCount}`} label="séries" />
        <PosterStat value={`${exerciseCount}`} label="exercícios" />
        <div className="-rotate-6 rounded-full bg-brand-orange px-5 py-4 text-[22px] font-black uppercase leading-tight text-brand-ink">
          {data.prs.length > 0 ? `${data.prs.length} PR${data.prs.length > 1 ? "s" : ""}` : "mais forte"}
        </div>
      </div>
      <p className="relative mt-10 text-[21px] font-bold uppercase tracking-[.25em] text-brand-paper/55">Uma sessão de cada vez.</p>
    </div>
  );
}

function SessionReplay({ data, date }: { data: ReturnType<typeof storyDataFrom>; date: string }) {
  const exercises = data.exercises.slice(0, 4);
  const hiddenExercises = data.hiddenExercises + data.exercises.length - exercises.length;

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-[88px] pb-[270px] pt-[285px] text-brand-ink">
      <div aria-hidden className="absolute -right-20 top-[365px] size-[320px] rounded-full border-[36px] border-brand-blue/10" />
      <div className="relative flex items-center justify-between border-b-2 border-brand-ink pb-5 text-[23px] font-bold uppercase tracking-[.2em]">
        <span>SESSION / REPLAY</span><span>{date}</span>
      </div>

      <h2 className="relative mt-12 text-[104px] font-black leading-[.84] tracking-[-.06em] text-brand-blue">REPLAY<span className="text-brand-orange">.</span></h2>
      <p className="relative mt-7 max-w-[780px] text-[38px] font-semibold leading-tight">O que ficou marcado em <span className="font-black">{data.routineName}</span></p>

      {exercises.length > 0 ? (
        <ol className="relative mt-14 space-y-0 border-l-[3px] border-brand-blue/20 pl-8">
          {exercises.map((exercise, i) => (
            <li key={exercise.name} className="relative border-b border-brand-ink/20 py-6 first:pt-0 last:border-b-0">
              <span aria-hidden className="absolute -left-[47px] top-7 flex size-8 items-center justify-center rounded-full bg-brand-paper text-[18px] font-black text-brand-blue">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-[31px] font-bold leading-tight">{exercise.name}</p>
                  <p className="mt-2 text-[21px] font-semibold uppercase tracking-[.12em] text-brand-ink/55">Melhor série</p>
                </div>
                <p className="num shrink-0 pt-1 text-[29px] font-black">{exercise.best.kg}<span className="ml-1 text-[18px]">kg</span><br /><span className="text-[22px]">× {exercise.best.reps}</span></p>
              </div>
              {exercise.hasPr && <span className="mt-3 inline-block -rotate-2 bg-brand-orange px-3 py-1 text-[17px] font-black uppercase tracking-[.12em]">Novo recorde</span>}
            </li>
          ))}
          {hiddenExercises > 0 && <li className="pt-3 text-[21px] font-bold uppercase tracking-[.12em] text-brand-blue">+ {hiddenExercises} exercício(s) nesta sessão</li>}
        </ol>
      ) : (
        <div className="relative mt-16 border-y-2 border-brand-ink/20 py-12">
          <p className="text-[32px] font-bold">Sessão registrada.</p>
          <p className="mt-3 text-[24px] text-brand-ink/65">{data.setsCount} séries · {data.durationMin} min de trabalho.</p>
        </div>
      )}

      <div className="relative mt-auto flex items-center justify-between border-t-2 border-brand-ink pt-6 text-[21px] font-bold uppercase tracking-[.13em]">
        <span>{data.durationMin} min de sessão</span>
        <span>{data.prs.length > 0 ? `${data.prs.length} recorde${data.prs.length > 1 ? "s" : ""}` : `${data.volumeKg.toLocaleString("pt-BR")} kg no total`}</span>
      </div>
      <p className="relative mt-9 text-[20px] font-bold uppercase tracking-[.24em] text-brand-ink/50">BCTRL · movimento real</p>
    </div>
  );
}

function PosterStat({ value, label }: { value: string; label: string }) {
  return <p className="flex flex-col gap-1"><span className="num text-[40px] font-black">{value}</span><span className="text-[19px] font-bold uppercase tracking-[.1em] text-brand-paper/65">{label}</span></p>;
}
