import { HexProgress, HEX_COLORS, type HexSegments } from "@/components/shell/hex-progress";
import { BrandWordmark } from "@/components/brand/brand-symbol";
import { HEX_CORE_POINTS, HEX_SEGMENT_KEYS, HEX_VIEWBOX } from "@/lib/domain/hex";
import { weekDays, weekStart } from "@/lib/domain/week";
import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { durationShort, storyDate } from "../format";
import type { StoryLayoutProps } from "../types";

/**
 * Hex Week: o símbolo do Bctrl Hub gigante como anel da semana (azul = treinos x/meta,
 * laranja = adesão alimentar, claro = hábitos), sem animação para a captura. O treino do
 * dia fica dentro do anel, em volta do núcleo. Embaixo, os 7 dias como hexágonos
 * (cheio = treinou; o dia deste treino com contorno laranja) e a legenda com números.
 */

const HEX_SIZE = 940;
const DAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];

export function HexWeek({ data }: StoryLayoutProps) {
  const week = data.week;
  const segments: HexSegments = {
    workouts: { progress: week?.progress.workouts ?? 0, label: "Treinos", value: week ? `${week.workouts}/${week.workoutsTarget}` : "—" },
    meals: { progress: week?.progress.meals ?? 0, label: "Alimentação", value: week ? `${week.mealsPct}%` : "—" },
    habits: { progress: week?.progress.habits ?? 0, label: "Hábitos", value: week ? `${week.habitsPct}%` : "—" },
  };
  const days = weekDays(weekStart(data.date));
  const trained = new Set(week?.days.filter((d) => d.trained).map((d) => d.day) ?? [data.date]);
  const first = storyDate(days[0]);
  const last = storyDate(days[6]);
  const nameSize = data.routineName.length <= 8 ? 76 : data.routineName.length <= 12 ? 58 : 44;
  const duration = durationShort(data.durationMin);

  return (
    <div className="absolute inset-0">
      {/* Halo azul discreto atrás do anel (gradiente, não filter: blur falha no Safari). */}
      <div
        aria-hidden
        className="absolute top-[260px] left-1/2 size-[1160px] -translate-x-1/2 bg-radial from-brand-blue/30 to-transparent to-65%"
      />

      <header className="absolute top-[270px] right-[90px] left-[90px] flex items-baseline justify-between">
        <BrandWordmark className="text-[46px] leading-none" />
        <p className="num text-[26px] tracking-[0.2em] uppercase opacity-85">
          Semana {first.long.split(" ").slice(0, 2).join(" ")} — {last.long.split(" ").slice(0, 2).join(" ")}
        </p>
      </header>

      <div className="absolute top-[340px] left-1/2 -translate-x-1/2" style={{ width: HEX_SIZE, height: HEX_SIZE }}>
        <HexProgress segments={segments} animate={false} title="Semana" className="size-full" />

        {/* Treino do dia dentro do anel: nome acima do núcleo, volume abaixo (a área livre
            do hexágono estreita perto das pontas, por isso só 2 informações aqui). */}
        <p
          className="absolute inset-x-0 top-[276px] mx-auto max-w-[520px] truncate text-center font-extrabold tracking-tight uppercase italic"
          style={{ fontSize: nameSize, lineHeight: 1.1 }}
        >
          {data.routineName}
        </p>
        <p className="absolute inset-x-0 top-[590px] text-center">
          <span className="num text-[84px] leading-none font-semibold tracking-tight">{formatInt(data.volumeKg)}</span>
          <span className="num ml-[10px] text-[30px] font-medium uppercase opacity-85">kg</span>
        </p>
      </div>

      <div className="absolute top-[1286px] inset-x-[90px] flex items-center justify-center gap-[22px]">
        <p className="num text-[30px] tracking-[0.12em] uppercase opacity-90">
          {duration.value}
          {duration.unit && ` ${duration.unit}`} · {data.setsCount} séries
        </p>
        {data.prs.length > 0 && (
          <p className="rounded-full bg-brand-orange px-[22px] py-[2px] text-[28px] font-bold text-brand-ink uppercase">
            {data.prs.length} {data.prs.length === 1 ? "PR" : "PRs"}
          </p>
        )}
      </div>

      <ol aria-label="Dias da semana" className="absolute top-[1366px] left-1/2 flex -translate-x-1/2 gap-[26px]">
        {days.map((day, i) => {
          const isToday = day === data.date;
          const done = trained.has(day);
          return (
            <li key={day} className="flex flex-col items-center gap-[8px]">
              <MiniHex filled={done} ring={isToday} />
              <span className={cn("num text-[24px]", isToday ? "font-semibold" : "opacity-70")}>{DAY_LETTERS[i]}</span>
            </li>
          );
        })}
      </ol>

      <dl className="absolute top-[1520px] right-[90px] left-[90px] grid grid-cols-3 gap-[36px]">
        {HEX_SEGMENT_KEYS.map((key) => (
          <div key={key}>
            <dt className="flex items-center gap-[14px] text-[26px] opacity-85">
              <span aria-hidden className="h-[12px] w-[52px] rounded-full" style={{ background: HEX_COLORS[key] }} />
              {segments[key].label}
            </dt>
            <dd className="num mt-[6px] text-[60px] leading-none font-semibold">{segments[key].value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Hexágono pequeno do dia: cheio quando treinou; contorno laranja no dia deste treino. */
function MiniHex({ filled, ring }: { filled: boolean; ring: boolean }) {
  return (
    <svg aria-hidden viewBox={`0 0 ${HEX_VIEWBOX} ${HEX_VIEWBOX}`} className="size-[72px]">
      <polygon
        points="100,14 175,57 175,143 100,186 25,143 25,57"
        fill={filled ? "var(--chart-1)" : "none"}
        stroke={ring ? "var(--chart-2)" : "currentColor"}
        strokeOpacity={ring ? 1 : filled ? 0 : 0.35}
        strokeWidth={ring ? 18 : 10}
      />
      {filled && <polygon points={HEX_CORE_POINTS} fill="currentColor" />}
    </svg>
  );
}
