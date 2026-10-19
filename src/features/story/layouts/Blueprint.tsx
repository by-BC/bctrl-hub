import { useId } from "react";
import { HEX_CORE_POINTS, HEX_SEGMENT_KEYS, HEX_SEGMENT_POINTS } from "@/lib/domain/hex";
import { formatInt } from "@/lib/format";
import { durationShort, setText, storyDate } from "../format";
import type { StoryLayoutProps } from "../types";

/**
 * Blueprint: o treino como prancha de engenharia. Fundo ultramarino com grade técnica,
 * moldura de folha com marcas de zona, o símbolo do Bctrl desenhado em arame com cotas,
 * o volume como medida principal entre linhas de cota, a "lista de peças" com a melhor
 * série de cada exercício e o carimbo (title block) no pé. Texto sempre off-white
 * (6,5:1 sobre o azul); o laranja só preenche marcadores de PR.
 */

export function Blueprint({ data }: StoryLayoutProps) {
  const date = storyDate(data.date);
  const duration = durationShort(data.durationMin);
  const nameSize = data.routineName.length <= 9 ? 132 : data.routineName.length <= 14 ? 96 : 72;
  const prExercises = new Set(data.prs.map((p) => p.exercise));

  return (
    <div className="absolute inset-0">
      <Grid />
      <SheetBorder />
      <WireframeHex />

      <div className="absolute inset-x-[90px] top-[270px] bottom-[250px] flex flex-col">
        <div className="num flex justify-between border-b-2 border-brand-paper/60 pb-[10px] text-[22px] tracking-[0.28em] uppercase">
          <span>Bctrl/hub · prancha de treino</span>
          <span>Fl. 01/01</span>
        </div>

        <p
          className="mt-[26px] truncate font-extrabold tracking-tight uppercase italic"
          style={{ fontSize: nameSize, lineHeight: 1.02 }}
        >
          {data.routineName}
        </p>
        <p className="num mt-[8px] text-[28px] tracking-[0.12em] uppercase">
          {date.weekday} · {date.dotted}
        </p>

        <Dimension label="Volume total" className="mt-[40px]" />
        <p className="flex items-baseline gap-[18px]">
          <span className="num text-[230px] leading-[0.9] font-medium tracking-[-0.04em]">{formatInt(data.volumeKg)}</span>
          <span className="num text-[56px] font-medium">KG</span>
        </p>

        <dl className="mt-[34px] grid grid-cols-3 border-2 border-brand-paper/70">
          <Cell label="Tempo" value={`${duration.value}${duration.unit ? ` ${duration.unit}` : ""}`} />
          <Cell label="Séries" value={String(data.setsCount)} border />
          <Cell label="Recordes" value={String(data.prs.length)} border marker={data.prs.length > 0} />
        </dl>

        <p className="num mt-[34px] text-[22px] tracking-[0.28em] uppercase">Lista de peças · melhor série</p>
        <ol className="mt-[10px] min-h-0 flex-1 overflow-hidden border-t-2 border-brand-paper/70">
          {data.exercises.map((exercise, i) => (
            <li key={exercise.name} className="flex h-[60px] items-center border-b border-brand-paper/40 text-[30px]">
              <span className="num w-[70px] shrink-0 opacity-85">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{exercise.name}</span>
              {prExercises.has(exercise.name) && (
                <span className="num mr-[20px] flex shrink-0 items-center gap-[8px] text-[22px] font-semibold">
                  <span aria-hidden className="size-[16px] bg-brand-orange" />
                  PR
                </span>
              )}
              <span className="num shrink-0 font-medium">{setText(exercise.best.kg, exercise.best.reps)}</span>
            </li>
          ))}
          {data.hiddenExercises > 0 && (
            <li className="num flex h-[60px] items-center text-[26px] uppercase opacity-90">
              + {data.hiddenExercises} {data.hiddenExercises === 1 ? "peça" : "peças"} no app
            </li>
          )}
        </ol>

        <TitleBlock dotted={date.dotted} week={data.week ? `${data.week.workouts}/${data.week.workoutsTarget}` : "—"} />
      </div>
    </div>
  );
}

function Cell({ label, value, border, marker }: { label: string; value: string; border?: boolean; marker?: boolean }) {
  return (
    <div className={border ? "border-l-2 border-brand-paper/70 px-[22px] py-[14px]" : "px-[22px] py-[14px]"}>
      <dt className="num flex items-center gap-[10px] text-[20px] tracking-[0.24em] uppercase opacity-90">
        {marker && <span aria-hidden className="size-[14px] bg-brand-orange" />}
        {label}
      </dt>
      <dd className="num mt-[4px] text-[60px] leading-none font-medium">{value}</dd>
    </div>
  );
}

/** Linha de cota: extensões nas pontas, setas e o rótulo no meio. */
function Dimension({ label, className }: { label: string; className?: string }) {
  return (
    <div className={className}>
      <svg aria-hidden viewBox="0 0 900 40" className="block h-[40px] w-full overflow-visible stroke-current">
        <line x1="1" y1="0" x2="1" y2="40" strokeWidth="2" />
        <line x1="899" y1="0" x2="899" y2="40" strokeWidth="2" />
        <line x1="1" y1="20" x2="330" y2="20" strokeWidth="2" />
        <line x1="570" y1="20" x2="899" y2="20" strokeWidth="2" />
        <polygon points="1,20 25,12 25,28" fill="currentColor" stroke="none" />
        <polygon points="899,20 875,12 875,28" fill="currentColor" stroke="none" />
      </svg>
      <p className="num -mt-[34px] text-center text-[22px] tracking-[0.3em] uppercase">{label}</p>
    </div>
  );
}

function TitleBlock({ dotted, week }: { dotted: string; week: string }) {
  const cell = "border-brand-paper/70 px-[18px] py-[10px]";
  const label = "num text-[18px] tracking-[0.24em] uppercase opacity-90";
  const value = "num mt-[2px] text-[30px] font-medium";
  return (
    <div className="relative mt-[20px] ml-auto grid w-[760px] grid-cols-[1.2fr_1fr_1fr] border-2 border-brand-paper/70 bg-brand-blue">
      <div className={cell}>
        <p className={label}>Data</p>
        <p className={value}>{dotted}</p>
      </div>
      <div className={`${cell} border-l-2`}>
        <p className={label}>Escala</p>
        <p className={value}>1:1</p>
      </div>
      <div className={`${cell} border-l-2`}>
        <p className={label}>Semana</p>
        <p className={value}>{week}</p>
      </div>
      <div className={`${cell} col-span-3 flex items-center justify-between border-t-2`}>
        <p className="font-extrabold tracking-tight italic text-[34px]">
          Bctrl<span className="num ml-[4px] font-medium not-italic">/hub</span>
        </p>
        <p className={label}>Be in control.</p>
      </div>
    </div>
  );
}

function Grid() {
  const id = useId();
  return (
    <svg aria-hidden className="absolute inset-0 size-full text-brand-paper">
      <defs>
        <pattern id={`${id}-minor`} width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M36 0H0V36" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="1.5" />
        </pattern>
        <pattern id={`${id}-major`} width="180" height="180" patternUnits="userSpaceOnUse">
          <rect width="180" height="180" fill={`url(#${id}-minor)`} />
          <path d="M180 0H0V180" fill="none" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id}-major)`} />
    </svg>
  );
}

/** Moldura da folha com marcas de zona (decorativa; passa pelas faixas de topo e base). */
function SheetBorder() {
  const zones = ["A", "B", "C", "D", "E", "F"];
  return (
    <div aria-hidden className="absolute inset-[40px] border-2 border-brand-paper/60">
      <div className="absolute inset-[16px] border border-brand-paper/40" />
      <div className="num absolute inset-x-0 top-[-34px] flex justify-around text-[18px] opacity-70">
        {[1, 2, 3, 4].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="num absolute inset-y-0 left-[-30px] flex flex-col justify-around text-[18px] opacity-70">
        {zones.map((z) => (
          <span key={z}>{z}</span>
        ))}
      </div>
    </div>
  );
}

/** O símbolo do Bctrl em arame, com círculo de construção, eixos e cota (decorativo, no canto livre). */
function WireframeHex() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      className="absolute top-[1290px] left-[-260px] size-[760px] text-brand-paper opacity-35"
    >
      <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="4 3" />
      <line x1="100" y1="2" x2="100" y2="198" stroke="currentColor" strokeWidth="0.4" strokeDasharray="8 3 2 3" />
      <line x1="2" y1="100" x2="198" y2="100" stroke="currentColor" strokeWidth="0.4" strokeDasharray="8 3 2 3" />
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="miter">
        {HEX_SEGMENT_KEYS.map((key) => (
          <polyline key={key} points={HEX_SEGMENT_POINTS[key]} />
        ))}
        <polygon points={HEX_CORE_POINTS} />
      </g>
      <g stroke="currentColor" strokeWidth="0.5">
        <line x1="30.7" y1="188" x2="169.3" y2="188" />
        <line x1="30.7" y1="183" x2="30.7" y2="193" />
        <line x1="169.3" y1="183" x2="169.3" y2="193" />
      </g>
    </svg>
  );
}
