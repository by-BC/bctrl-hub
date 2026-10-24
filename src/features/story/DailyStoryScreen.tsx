"use client";

import { ArrowLeft, Download, ImagePlus, LoaderCircle, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyScores } from "@/features/profile/hooks";
import { useToday } from "@/features/progress/use-today";
import { formatDay } from "@/lib/format";
import { loadPhoto } from "./photo";
import { DailyStoryCanvas, DAILY_STORY_LAYOUTS, type DailyStoryLayout } from "./DailyStoryCanvas";
import { downloadStory, exportStory, shareOrDownload, STORY_HEIGHT, STORY_WIDTH } from "./export";
import { useCanShare, usePreviewScale } from "./StoryStudio";
import type { StoryPhoto } from "./types";

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
  const [layout, setLayout] = useState<DailyStoryLayout>(DAILY_STORY_LAYOUTS[0]);
  const [photo, setPhoto] = useState<StoryPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const scale = usePreviewScale(boxRef, 0.68);
  const canShare = useCanShare();

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    try {
      const src = await loadPhoto(file);
      setPhoto({ src, zoom: 1, x: 50, y: 50 });
      setLayout("Foto + resumo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível abrir a foto.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onExport() {
    if (!frameRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(frameRef.current);
      const filename = `bctrl-dia-${facts.day}-${layout.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}.png`;
      const outcome = await shareOrDownload(blob, filename);
      if (outcome === "downloaded") toast.success("Story do dia baixado (PNG 1080×1920).");
    } catch (error) {
      console.error("[bctrl]", "Falha ao gerar o story do dia.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function savePng() {
    if (!frameRef.current || busy) return;
    setBusy(true);
    try {
      const blob = await exportStory(frameRef.current);
      downloadStory(blob, `bctrl-dia-${facts.day}-${layout.toLocaleLowerCase("pt-BR").replaceAll(" ", "-")}.png`);
      toast.success("Story do dia salvo no aparelho.");
    } catch (error) {
      console.error("[bctrl]", "Falha ao salvar o story do dia.", error);
      toast.error("Não foi possível gerar a imagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BackLink />
      <PageHeader title="Story do dia" eyebrow={formatDay(facts.day)} />
      <div className="flex flex-col gap-5 sm:gap-7 xl:flex-row xl:items-start xl:gap-10">
        <div ref={boxRef} className="min-w-0 xl:w-[460px] xl:shrink-0">
          <div className="flex justify-center py-2">
            <div className="overflow-hidden rounded-xl shadow-lg ring-1 ring-border" style={{ width: Math.round(STORY_WIDTH * scale), height: Math.round(STORY_HEIGHT * scale), backgroundColor: "#27292f", backgroundImage: "linear-gradient(45deg,rgba(255,255,255,.10) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.10) 75%),linear-gradient(45deg,rgba(255,255,255,.10) 25%,transparent 25%,transparent 75%,rgba(255,255,255,.10) 75%)", backgroundPosition: "0 0,12px 12px", backgroundSize: "24px 24px" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
                <DailyStoryCanvas facts={facts} layout={layout} photo={photo} ref={frameRef} />
              </div>
            </div>
          </div>
          <div role="group" aria-label="Modelos do story do dia" className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0">
            {DAILY_STORY_LAYOUTS.map((name) => <Button key={name} variant={layout === name ? "default" : "outline"} className="min-h-11 shrink-0 snap-start" aria-pressed={layout === name} onClick={() => setLayout(name)}>{name}</Button>)}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 xl:max-w-xl xl:pt-2">
          <section className="space-y-3" aria-labelledby="daily-story-photo-title">
            <div><h2 id="daily-story-photo-title" className="font-semibold">Foto do dia <span className="font-normal text-muted-foreground">(opcional)</span></h2><p className="text-sm text-muted-foreground">O resumo reúne treino, alimentação, hábitos e tarefas.</p></div>
            <input ref={fileRef} type="file" accept="image/*" aria-label="Escolher foto para o story do dia" className="sr-only" onChange={(event) => choosePhoto(event.target.files?.[0])} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}><ImagePlus aria-hidden />{photo ? "Trocar foto" : "Tirar ou escolher foto"}</Button>
              {photo && <Button type="button" variant="ghost" className="min-h-11" onClick={() => setPhoto(null)}><Trash2 aria-hidden />Remover foto</Button>}
            </div>
            {photo && layout === "Foto + resumo" && <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 text-sm font-semibold">Enquadrar foto</legend>
              <label className="block text-sm">Zoom <span className="num text-muted-foreground">{Math.round(photo.zoom * 100)}%</span><input type="range" min="100" max="200" step="5" value={Math.round(photo.zoom * 100)} aria-label="Zoom da foto" onChange={(event) => setPhoto({ ...photo, zoom: Number(event.target.value) / 100 })} className="h-11 w-full accent-primary" /></label>
              <label className="block text-sm">Posição horizontal<input type="range" min="0" max="100" value={photo.x} aria-label="Posição horizontal da foto" onChange={(event) => setPhoto({ ...photo, x: Number(event.target.value) })} className="h-11 w-full accent-primary" /></label>
              <label className="block text-sm">Posição vertical<input type="range" min="0" max="100" value={photo.y} aria-label="Posição vertical da foto" onChange={(event) => setPhoto({ ...photo, y: Number(event.target.value) })} className="h-11 w-full accent-primary" /></label>
            </fieldset>}
          </section>

          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 space-y-2 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_20px_-16px_rgba(0,0,0,0.45)] backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:py-5 lg:shadow-none lg:backdrop-blur-none">
            <Button className="h-12 w-full text-base font-semibold" disabled={busy} onClick={savePng}>{busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Download aria-hidden />}{busy ? "Gerando…" : "Baixar PNG"}</Button>
            {canShare && <Button variant="outline" className="h-12 w-full" disabled={busy} onClick={onExport}><Share2 aria-hidden />Compartilhar</Button>}
            <p className="text-xs text-muted-foreground">A imagem é gerada neste aparelho e não é enviada para o servidor.</p>
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
