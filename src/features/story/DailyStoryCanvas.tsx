import { ImagePlus } from "lucide-react";
import type { Ref } from "react";
import type { DayFacts, CriterionKey } from "@/lib/domain/score";
import { formatDay, formatInt } from "@/lib/format";
import { DailyCard } from "./DailyCard";
import { StoryFrame } from "./StoryFrame";
import type { StoryPhoto } from "./types";

export const DAILY_STORY_LAYOUTS = ["Resumo", "Recibo", "Placar", "Foto + resumo"] as const;
export type DailyStoryLayout = (typeof DAILY_STORY_LAYOUTS)[number];

const ROWS: { key: CriterionKey; label: string; detail: (facts: DayFacts) => string }[] = [
  { key: "trained", label: "Treino", detail: (facts) => facts.workouts ? `${formatInt(facts.workouts)} ${facts.workouts === 1 ? "sessão" : "sessões"}` : facts.trained ? "Cardio registrado" : "Sem atividade" },
  { key: "diet", label: "Alimentação", detail: (facts) => facts.mealsPlanned ? `${facts.mealsDone}/${facts.mealsPlanned} refeições` : "Sem plano hoje" },
  { key: "habits", label: "Hábitos", detail: (facts) => facts.habits ? "Meta cumprida" : "Não pontuou" },
  { key: "tasks", label: "Tarefas", detail: (facts) => facts.tasks ? "Concluída" : "Sem conclusão" },
];

export function DailyStoryCanvas({ facts, layout, photo, ref }: { facts: DayFacts; layout: DailyStoryLayout; photo: StoryPhoto | null; ref: Ref<HTMLDivElement> }) {
  return (
    <StoryFrame tone="ink" ref={ref}>
      {layout === "Resumo" && <DailyCard facts={facts} />}
      {layout === "Recibo" && <DailyReceipt facts={facts} />}
      {layout === "Placar" && <DailyScoreboard facts={facts} />}
      {layout === "Foto + resumo" && <DailyPhotoOverlay facts={facts} photo={photo} />}
    </StoryFrame>
  );
}

function DailyReceipt({ facts }: { facts: DayFacts }) {
  return (
    <div className="absolute inset-0 flex flex-col px-[100px] pb-[270px] pt-[270px] text-brand-paper">
      <p className="text-[24px] font-bold uppercase tracking-[.22em] text-brand-orange">BCTRL · FECHAMENTO DIÁRIO</p>
      <h2 className="mt-12 text-[102px] font-black leading-[.84] tracking-[-.07em]">SEU DIA<br />EM FOCO<span className="text-brand-orange">.</span></h2>
      <p className="mt-8 text-[34px] font-semibold text-brand-paper/70">{formatDay(facts.day)}</p>
      <div className="mt-14 border-y-2 border-dashed border-brand-paper/35">
        {ROWS.map(({ key, label, detail }) => <div key={key} className="flex items-center gap-5 border-b border-brand-paper/15 py-7 last:border-0">
          <span aria-hidden className={`flex size-12 shrink-0 items-center justify-center rounded-full text-[24px] font-black ${facts[key] ? "bg-brand-orange text-brand-ink" : "bg-brand-paper/10 text-brand-paper/55"}`}>{facts[key] ? "✓" : "–"}</span>
          <span className="min-w-0 flex-1"><span className="block text-[24px] font-bold uppercase tracking-[.15em] text-brand-paper/65">{label}</span><span className="mt-2 block text-[34px] font-semibold leading-tight">{detail(facts)}</span></span>
          <span className="num text-[24px] font-bold uppercase text-brand-paper/55">{facts[key] ? "OK" : "—"}</span>
        </div>)}
      </div>
      <div className="mt-auto flex items-end justify-between border-t-2 border-brand-orange pt-7">
        <div><p className="text-[22px] font-bold uppercase tracking-[.2em] text-brand-paper/60">PONTOS NO DIA</p><p className="num mt-2 text-[104px] font-black leading-none">{facts.score}<span className="ml-2 text-[44px] text-brand-paper/50">/4</span></p></div>
        <p className="max-w-[300px] text-right text-[27px] font-bold uppercase leading-tight text-brand-orange">{facts.score >= 3 ? "Dia no controle" : "Um passo de cada vez"}</p>
      </div>
    </div>
  );
}

function DailyScoreboard({ facts }: { facts: DayFacts }) {
  return (
    <div className="absolute inset-0 overflow-hidden px-[90px] pb-[270px] pt-[270px] text-brand-paper">
      <div aria-hidden className="absolute -right-[280px] top-[370px] size-[900px] rounded-full border-[3px] border-brand-blue/70" />
      <div aria-hidden className="absolute -right-[190px] top-[460px] size-[720px] rounded-full border-[3px] border-brand-orange/50" />
      <p className="relative text-[24px] font-bold uppercase tracking-[.24em] text-brand-orange">PAINEL DE CONTROLE · {formatDay(facts.day)}</p>
      <div className="relative mt-16 flex items-end gap-5">
        <p className="num text-[310px] font-black leading-[.78] tracking-[-.09em]">{facts.score}</p>
        <p className="pb-4 text-[48px] font-bold text-brand-paper/55">/ 4</p>
      </div>
      <h2 className="relative mt-9 max-w-[800px] text-[72px] font-black leading-[.9] tracking-[-.05em]">{facts.score >= 3 ? "DIA NO CONTROLE" : "SEGUINDO NO SEU RITMO"}<span className="text-brand-orange">.</span></h2>
      <div className="relative mt-20 grid grid-cols-2 gap-5">
        {ROWS.map(({ key, label, detail }, i) => <article key={key} className="min-h-[190px] rounded-[24px] border border-brand-paper/20 bg-brand-paper/5 p-6">
          <p className="num text-[21px] font-bold tracking-[.18em] text-brand-orange">0{i + 1} / 04</p>
          <p className="mt-5 text-[26px] font-black uppercase tracking-[.08em]">{label}</p>
          <p className="mt-3 text-[29px] font-semibold leading-tight text-brand-paper/75">{detail(facts)}</p>
        </article>)}
      </div>
      <dl className="relative mt-12 grid grid-cols-3 border-y border-brand-paper/25 py-6">
        <DailyStat label="Treinos" value={formatInt(facts.workouts)} />
        <DailyStat label="Volume · kg" value={facts.workouts ? formatInt(Math.round(facts.volumeKg)) : "—"} />
        <DailyStat label="Recordes" value={formatInt(facts.prs)} />
      </dl>
      <p className="num relative mt-12 text-center text-[21px] font-bold uppercase tracking-[.3em] text-brand-paper/55">BE IN CONTROL.</p>
    </div>
  );
}

function DailyStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-4 first:pl-0 last:pr-0 [&+div]:border-l [&+div]:border-brand-paper/25"><dt className="text-[18px] font-bold uppercase tracking-[.12em] text-brand-paper/55">{label}</dt><dd className="num mt-3 truncate text-[38px] font-black">{value}</dd></div>;
}

function DailyPhotoOverlay({ facts, photo }: { facts: DayFacts; photo: StoryPhoto | null }) {
  const origin = photo ? `${photo.x}% ${photo.y}%` : "50% 50%";
  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-blue text-brand-paper">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto local convertida em dataURL
        <img src={photo.src} alt="" aria-hidden className="absolute inset-0 size-full object-cover" style={{ objectPosition: origin, transform: `scale(${photo.zoom})`, transformOrigin: origin }} />
      ) : <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_25%,rgba(217,103,53,.55),transparent_42%),linear-gradient(145deg,#1f419f,#15161a_70%)]" />}
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-brand-ink via-brand-ink/70 via-55% to-brand-ink/10" />
      <div className="absolute inset-x-[90px] top-[270px] flex items-center justify-between">
        <p className="text-[24px] font-bold uppercase tracking-[.22em]">RESUMO DO DIA</p><p className="num text-[24px] font-bold">{formatDay(facts.day)}</p>
      </div>
      <div className="absolute inset-x-[90px] bottom-[300px]">
        <p className="text-[24px] font-bold uppercase tracking-[.22em] text-brand-orange">UM DIA DE CADA VEZ</p>
        <div className="mt-5 flex items-end gap-5"><p className="num text-[230px] font-black leading-[.8] tracking-[-.1em]">{facts.score}</p><p className="pb-3 text-[42px] font-bold text-brand-paper/65">/ 4</p></div>
        <h2 className="mt-6 text-[70px] font-black leading-[.88] tracking-[-.05em]">{facts.score >= 3 ? "DIA NO CONTROLE" : "NO SEU RITMO"}<span className="text-brand-orange">.</span></h2>
        <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-brand-paper/35 pt-7">
          {ROWS.map(({ key, label }) => <p key={key} className="flex items-center gap-3 text-[23px] font-bold uppercase"><span className={`size-4 rounded-full ${facts[key] ? "bg-brand-orange" : "bg-brand-paper/30"}`} />{label}</p>)}
        </div>
      </div>
      {!photo && <div className="absolute inset-x-0 bottom-[250px] flex justify-center"><p className="flex items-center gap-3 rounded-full border border-brand-paper/35 bg-brand-ink/55 px-6 py-3 text-[20px] font-bold"><ImagePlus aria-hidden className="size-6" /> ADICIONE UMA FOTO</p></div>}
    </div>
  );
}
