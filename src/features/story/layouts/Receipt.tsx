import { Scissors } from "lucide-react";
import type { ReactNode } from "react";
import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import type { StoryExercise } from "@/lib/domain/story";
import { formatDuration, formatInt, formatKg } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STORY_PR_LABELS, barcodeBars, prValueText, setText, storyDate } from "../format";
import type { StoryLayoutProps } from "../types";

/**
 * Recibo: o treino como cupom fiscal saindo da "impressora" no topo. IBM Plex Mono do
 * começo ao fim, uma linha por série (com muitas séries, uma linha de séries por
 * exercício), o "total" é o volume em kg, PRs num bloco invertido, picote e um código de
 * barras decorativo feito com a data. O papel tem o comprimento do treino (até 1650 px,
 * o limite da área segura); o picote e o canhoto, decorativos, podem passar disso.
 */

/** Acima disso (exercícios + séries), cada exercício vira 2 linhas: nome e séries. */
const FULL_LINES_MAX = 15;
const PRS_SHOWN = 3;

export function Receipt({ data }: StoryLayoutProps) {
  const date = storyDate(data.date);
  const lines = data.exercises.reduce((n, e) => n + 1 + e.sets.length, 0);
  const full = lines <= FULL_LINES_MAX;

  return (
    <div className="absolute inset-0">
      {/* Fenda da impressora (decorativa, na faixa do topo). */}
      <div aria-hidden className="absolute top-[132px] right-[84px] left-[84px] h-[44px] rounded-full bg-brand-paper/10 shadow-inner" />
      <div aria-hidden className="absolute top-[150px] right-[104px] left-[104px] h-[10px] rounded-full bg-brand-ink" />

      <div className="story-paper absolute top-[156px] left-[130px] w-[820px]">
        <div className="flex max-h-[1494px] flex-col bg-brand-paper shadow-2xl px-[60px] pt-[114px] pb-[20px] font-mono text-[28px] leading-[40px]">
          <header className="flex flex-col items-center gap-[14px] text-center">
            <div className="flex items-center gap-[18px]">
              <BrandSymbol title="" aria-hidden className="size-[76px] text-brand-ink" />
              <BrandWordmark className="text-[52px] leading-none" />
            </div>
            <p className="text-[22px] tracking-[0.32em] uppercase">Cupom de treino · Nº {date.digits}</p>
          </header>

          <Rule />
          <p className="text-center font-sans text-[64px] leading-[1.05] font-extrabold tracking-tight uppercase italic line-clamp-2">
            {data.routineName}
          </p>
          <div className="mt-[12px] flex justify-between text-[24px] uppercase">
            <span>{date.weekday}</span>
            <span>{date.dotted}</span>
          </div>
          <Rule />

          <div className="flex justify-between text-[20px] tracking-[0.2em] uppercase opacity-80">
            <span>{full ? "Série · kg × reps" : "Exercício · séries"}</span>
            <span>Vol. kg</span>
          </div>
          <ol className="mt-[6px] min-h-0 flex-1 overflow-hidden">
            {data.exercises.map((exercise) => (
              <li key={exercise.name} className="mb-[6px]">
                {full ? <FullExercise exercise={exercise} /> : <InlineExercise exercise={exercise} />}
              </li>
            ))}
            {data.hiddenExercises > 0 && (
              <li className="uppercase">
                + {data.hiddenExercises} {data.hiddenExercises === 1 ? "exercício" : "exercícios"} no app
              </li>
            )}
          </ol>

          <div aria-hidden className="my-[14px] h-[10px] border-y-[3px] border-brand-ink" />
          <Row label="Séries" value={String(data.setsCount)} />
          <Row label="Duração" value={formatDuration(data.durationMin)} />
          <div className="mt-[4px] flex items-end justify-between">
            <span className="text-[40px] font-semibold uppercase">Total kg</span>
            <span className="num text-[92px] leading-none font-semibold tracking-tight">{formatInt(data.volumeKg)}</span>
          </div>

          <Prs data={data} />
          <p className="pt-[22px] text-center text-[22px] tracking-[0.32em] uppercase">Be in control.</p>
        </div>

        {/* Picote + canhoto com o código de barras (decorativos). */}
        <div className="relative bg-brand-paper px-[60px] pt-[22px] pb-[18px]">
          <div aria-hidden className="absolute inset-x-[20px] top-0 border-t-[3px] border-dashed border-brand-ink/50" />
          <Scissors aria-hidden className="absolute -top-[19px] left-[22px] size-[36px] -rotate-90 bg-brand-paper text-brand-ink" />
          <Barcode text={date.digits} />
          <p className="num mt-[6px] text-center text-[22px] tracking-[0.6em]">{date.digits}</p>
        </div>
        <Zigzag />
      </div>
    </div>
  );
}

function Rule() {
  return <div aria-hidden className="my-[18px] border-t-[3px] border-dashed border-brand-ink/60" />;
}

function Leader() {
  return <span aria-hidden className="mx-[10px] mb-[10px] min-w-[24px] flex-1 border-b-[3px] border-dotted border-brand-ink/40" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end uppercase">
      <span>{label}</span>
      <Leader />
      <span className="num">{value}</span>
    </div>
  );
}

function PrTag() {
  return (
    <span className="mr-[10px] rounded-[6px] bg-brand-ink px-[8px] text-[20px] leading-[30px] font-semibold text-brand-paper">PR</span>
  );
}

function FullExercise({ exercise }: { exercise: StoryExercise }) {
  return (
    <>
      <p className="truncate font-semibold uppercase">{exercise.name}</p>
      {exercise.sets.map((set, i) => (
        <div key={i} className="flex items-end">
          <span className="num w-[56px] shrink-0 text-right opacity-70">{String(i + 1).padStart(2, "0")}</span>
          <span className={cn("num ml-[20px] shrink-0", set.prs.length > 0 && "font-semibold")}>
            {setText(set.kg, set.reps)}
          </span>
          <Leader />
          {set.prs.length > 0 && <PrTag />}
          <span className="num shrink-0">{formatInt(set.kg * set.reps)}</span>
        </div>
      ))}
    </>
  );
}

function InlineExercise({ exercise }: { exercise: StoryExercise }) {
  return (
    <>
      <div className="flex items-end">
        <span className="min-w-0 truncate font-semibold uppercase">{exercise.name}</span>
        <Leader />
        {exercise.hasPr && <PrTag />}
        <span className="num shrink-0">{formatInt(exercise.volumeKg)}</span>
      </div>
      <p className="num truncate pl-[24px] text-[24px] leading-[34px] opacity-80">
        {exercise.sets.length}× ·{" "}
        {exercise.sets.map((s, i) => (
          <Join key={i} last={i === exercise.sets.length - 1}>
            <span className={cn(s.prs.length > 0 && "font-semibold underline decoration-2 underline-offset-4")}>
              {s.kg > 0 ? `${formatKg(s.kg)}×${s.reps}` : `${s.reps}r`}
            </span>
          </Join>
        ))}
      </p>
    </>
  );
}

function Join({ children, last }: { children: ReactNode; last: boolean }) {
  return (
    <>
      {children}
      {!last && " · "}
    </>
  );
}

function Prs({ data }: StoryLayoutProps) {
  if (data.prs.length === 0) {
    return <p className="mt-[18px] text-center text-[24px] uppercase">Sem PR hoje · volume também é progresso</p>;
  }
  const shown = data.prs.slice(0, PRS_SHOWN);
  const rest = data.prs.length - shown.length;
  return (
    <section className="mt-[20px] rounded-[10px] bg-brand-ink px-[28px] py-[18px] text-brand-paper">
      <h3 className="flex items-center gap-[14px] text-[24px] font-semibold tracking-[0.24em] uppercase">
        <span aria-hidden className="size-[18px] bg-brand-orange" />
        Recordes · {data.prs.length}
      </h3>
      <ul className="mt-[6px] text-[26px] leading-[38px]">
        {shown.map((pr) => (
          <li key={`${pr.exercise}-${pr.kind}`} className="flex items-end uppercase">
            <span className="min-w-0 truncate">
              {pr.exercise} · {STORY_PR_LABELS[pr.kind]}
            </span>
            <span aria-hidden className="mx-[10px] mb-[9px] min-w-[20px] flex-1 border-b-[3px] border-dotted border-brand-paper/40" />
            <span className="num shrink-0 font-semibold">{prValueText(pr.kind, pr.value)}</span>
          </li>
        ))}
        {rest > 0 && <li className="uppercase opacity-80">+ {rest} no app</li>}
      </ul>
    </section>
  );
}

function Barcode({ text }: { text: string }) {
  const unit = 5;
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  for (const b of barcodeBars(text)) {
    bars.push({ x, w: b.bar * unit });
    x += (b.bar + b.gap) * unit;
  }
  return (
    <svg aria-hidden viewBox={`0 0 ${x} 100`} preserveAspectRatio="none" fill="currentColor" className="block h-[96px] w-full">
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={100} />
      ))}
    </svg>
  );
}

/** Borda serrilhada do papel rasgado. */
function Zigzag() {
  const teeth = 20;
  const w = 820 / teeth;
  const points = ["0,0"];
  for (let i = 0; i < teeth; i++) points.push(`${i * w + w / 2},26`, `${(i + 1) * w},0`);
  return (
    <svg aria-hidden viewBox="0 0 820 26" className="block h-[26px] w-[820px] fill-brand-paper">
      <polygon points={points.join(" ")} />
    </svg>
  );
}
