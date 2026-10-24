"use client";

import { ArrowLeft, Download, ImagePlus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useWorkoutDetail } from "@/features/history/hooks";
import { useWeekSummary } from "@/features/week/hooks";
import { weekStart } from "@/lib/domain/week";
import { formatDay } from "@/lib/format";
import { loadPhoto } from "./photo";
import { downloadStory, exportStory, shareOrDownload, STORY_HEIGHT, STORY_WIDTH } from "./export";
import { storyDataFrom } from "./data";
import { useCanShare, usePreviewScale } from "./StoryStudio";
import { WorkoutStoryCanvas, WORKOUT_STORY_MODELS, type WorkoutStoryModel, type WorkoutStoryOptions } from "./WorkoutStoryCanvas";
import type { StoryPhoto } from "./types";

const uuid = z.guid();

export function WorkoutStoryScreen({ id }: { id: string }) {
  const validId = uuid.safeParse(id).success;
  const detail = useWorkoutDetail(id, validId);
  const workout = validId ? detail.data : null;
  const week = useWeekSummary(workout ? weekStart(workout.day) : null);

  if (validId && (detail.isPending || (workout && week.isPending))) {
    return <div className="space-y-4" aria-busy="true" aria-label="Carregando story"><div className="h-10 w-48 animate-pulse rounded bg-muted" /><div className="aspect-[9/16] w-full max-w-[260px] animate-pulse rounded-xl bg-muted" /></div>;
  }
  if (!workout) {
    return <div role="alert" className="space-y-3"><p>Não foi possível encontrar este treino salvo.</p><Button asChild variant="outline"><Link href="/treino/historico">Voltar ao histórico</Link></Button></div>;
  }

  return <WorkoutStoryStudio data={storyDataFrom(workout, week.data ?? null)} workoutId={workout.id} />;
}

function WorkoutStoryStudio({ data, workoutId }: { data: ReturnType<typeof storyDataFrom>; workoutId: string }) {
  const [model, setModel] = useState<WorkoutStoryModel>(WORKOUT_STORY_MODELS[0]);
  const [options, setOptions] = useState<WorkoutStoryOptions>({ volume: true, duration: true, sets: true, exercises: true, records: true, caption: "" });
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [photoMode, setPhotoMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scale = usePreviewScale(previewRef, 0.68);
  const canShare = useCanShare();
  const date = useMemo(() => formatDay(data.date), [data.date]);
  const hasPhotoBackground = photoMode && !!photo;
  const transparentExport = !hasPhotoBackground;

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const src = await loadPhoto(file);
      setPhoto({ src, zoom: 1, x: 50, y: 50 });
      setPhotoMode(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a foto.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function savePng() {
    if (!frameRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(frameRef.current);
      const suffix = transparentExport ? "transparente" : "com-foto";
      downloadStory(blob, `bctrl-treino-${data.date}-${model.toLocaleLowerCase("pt-BR")}-${suffix}.png`);
      toast.success(transparentExport ? "PNG transparente salvo no aparelho." : "Story com a foto salvo no aparelho.");
    } catch (error) {
      console.error("[bctrl]", "Falha ao salvar o story do treino.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!frameRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(frameRef.current);
      const suffix = transparentExport ? "transparente" : "com-foto";
      const outcome = await shareOrDownload(blob, `bctrl-treino-${data.date}-${suffix}.png`);
      if (outcome === "downloaded") toast.success("Story baixado como PNG.");
    } catch (error) {
      console.error("[bctrl]", "Falha ao compartilhar o story do treino.", error);
      toast.error("Não foi possível compartilhar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function toggleOption(key: Exclude<keyof WorkoutStoryOptions, "caption">, checked: boolean | "indeterminate") {
    setOptions((current) => ({ ...current, [key]: checked === true }));
  }

  return (
    <>
      <Link href={`/treino/historico/${workoutId}`} className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ArrowLeft aria-hidden className="size-4" /> Voltar ao treino
      </Link>
      <PageHeader title="Monte seu story" eyebrow="Treino" />
      <div className="flex flex-col gap-5 sm:gap-7 xl:flex-row xl:items-start xl:gap-10">
        <div ref={previewRef} className="min-w-0 xl:w-[460px] xl:shrink-0">
          <div className="flex justify-center py-2">
            <div
              className="overflow-hidden rounded-xl shadow-lg ring-1 ring-border"
              style={{
                width: Math.round(STORY_WIDTH * scale),
                height: Math.round(STORY_HEIGHT * scale),
                backgroundColor: "#fff",
                backgroundImage: "linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%)",
                backgroundPosition: "0 0,12px 12px",
                backgroundSize: "24px 24px",
              }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <WorkoutStoryCanvas data={data} date={date} model={model} options={options} photo={photo} photoMode={hasPhotoBackground} ref={frameRef} />
              </div>
            </div>
          </div>
          <div role="group" aria-label="Modelos de story do treino" className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0">
            {WORKOUT_STORY_MODELS.map((name) => <Button key={name} variant={model === name ? "default" : "outline"} className="min-h-11 shrink-0 snap-start" aria-pressed={model === name} onClick={() => setModel(name)}>{name}</Button>)}
          </div>
          <p aria-live="polite" className="mt-3 text-center text-sm text-muted-foreground">
            {transparentExport ? "Prévia quadriculada = transparência. Baixe o PNG para aplicar sobre sua foto." : "A foto e os dados ficam neste aparelho; nada é enviado para o servidor."}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 xl:max-w-xl xl:pt-2">
          <section className="space-y-3" aria-labelledby="story-background-title">
            <div>
              <h2 id="story-background-title" className="font-semibold">Foto e fundo</h2>
              <p className="text-sm text-muted-foreground">Use uma foto no story ou salve só o adesivo com transparência.</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" aria-label="Escolher foto do treino" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={hasPhotoBackground ? "default" : "outline"} className="min-h-11" onClick={() => fileRef.current?.click()}>
                <ImagePlus aria-hidden />{photo ? "Trocar foto" : "Tirar ou escolher foto"}
              </Button>
              <Button type="button" variant={!hasPhotoBackground ? "default" : "outline"} className="min-h-11" aria-pressed={!hasPhotoBackground} onClick={() => setPhotoMode(false)}>
                <span aria-hidden className="size-4 rounded border border-current [background-image:linear-gradient(45deg,#999_25%,transparent_25%,transparent_75%,#999_75%)] [background-size:8px_8px]" /> PNG sem fundo
              </Button>
              {photo && <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setPhoto(null); setPhotoMode(false); }}><Trash2 aria-hidden /> Remover foto</Button>}
            </div>
            {photo && hasPhotoBackground && (
              <fieldset className="space-y-3 rounded-xl border p-4">
                <legend className="px-1 text-sm font-semibold">Enquadrar foto</legend>
                <label className="block text-sm">Zoom <span className="num text-muted-foreground">{Math.round(photo.zoom * 100)}%</span>
                  <input type="range" min="100" max="200" step="5" value={Math.round(photo.zoom * 100)} aria-label="Zoom da foto" onChange={(event) => setPhoto({ ...photo, zoom: Number(event.target.value) / 100 })} className="h-11 w-full accent-primary" />
                </label>
                <label className="block text-sm">Posição horizontal
                  <input type="range" min="0" max="100" value={photo.x} aria-label="Posição horizontal da foto" onChange={(event) => setPhoto({ ...photo, x: Number(event.target.value) })} className="h-11 w-full accent-primary" />
                </label>
                <label className="block text-sm">Posição vertical
                  <input type="range" min="0" max="100" value={photo.y} aria-label="Posição vertical da foto" onChange={(event) => setPhoto({ ...photo, y: Number(event.target.value) })} className="h-11 w-full accent-primary" />
                </label>
              </fieldset>
            )}
          </section>

          <fieldset className="space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">O que vai aparecer</legend>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3">
              <StoryOption label="Volume" checked={options.volume} onChange={(checked) => toggleOption("volume", checked)} />
              <StoryOption label="Duração" checked={options.duration} onChange={(checked) => toggleOption("duration", checked)} />
              <StoryOption label="Séries" checked={options.sets} onChange={(checked) => toggleOption("sets", checked)} />
              <StoryOption label="Exercícios" checked={options.exercises} onChange={(checked) => toggleOption("exercises", checked)} />
              <StoryOption label="Recordes" checked={options.records} onChange={(checked) => toggleOption("records", checked)} />
            </div>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="story-caption">
              Uma frase sua <span className="font-normal text-muted-foreground">(opcional)</span>
              <Input id="story-caption" maxLength={48} value={options.caption} onChange={(event) => setOptions((current) => ({ ...current, caption: event.target.value }))} placeholder="Ex.: Mais um treino feito" />
            </label>
          </fieldset>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 space-y-2 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.45)] backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-5 lg:shadow-none lg:backdrop-blur-none">
            <Button className="h-12 w-full text-base font-semibold" disabled={busy} onClick={savePng}>
              {busy ? <span className="animate-spin" aria-hidden>◌</span> : <Download aria-hidden />}
              {busy ? "Gerando…" : transparentExport ? "Baixar PNG transparente" : "Baixar story com foto"}
            </Button>
            {canShare && <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={share}><Share2 aria-hidden />Compartilhar</Button>}
            <p className="text-xs text-muted-foreground">PNG em 1080×1920. No modo sem fundo, as áreas transparentes preservam sua foto ao sobrepor no Instagram.</p>
          </div>
        </div>
      </div>
    </>
  );
}

function StoryOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = `story-option-${label.toLowerCase()}`;
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
