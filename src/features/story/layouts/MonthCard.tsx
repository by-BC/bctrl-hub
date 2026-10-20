import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import { heatColor } from "@/lib/domain/month-view";
import type { MonthCardData, MonthCardDay } from "@/lib/domain/month-card";
import { formatInt, formatShortDay } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Card do mês (RF17), no tom grafite do Hex Week: o nome do mês em Sora itálico gigante, o
 * mês como calendário de hexágonos da marca (segunda a domingo, cor = pontuação do dia 0–4 na
 * mesma escala sequencial do heatmap do Perfil, com o número do dia dentro para não depender
 * da cor), "dias no controle" como número principal ao lado, depois treinos, volume, PRs e
 * adesão, e as conquistas desbloqueadas no mês. Tudo entre as faixas de 250 px.
 *
 * SVG com cor por `fill="currentColor"` (a cor vem do `color` do próprio svg); nada de CSS
 * `filter` (falha no Safari dentro do `foreignObject`).
 */

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
/** Hexágono "em pé" da marca, recortado ao próprio contorno (150 × 172). */
const HEX_POINTS = "100,14 175,57 175,143 100,186 25,143 25,57";
const HEX_VIEWBOX = "25 14 150 172";
/** Hexágono do dia (largura × altura); mês de 6 semanas usa o menor para caber. */
const CELL = { regular: { w: 77, h: 88, gap: 6 }, compact: { w: 70, h: 80, gap: 4 } };
const ACHIEVEMENTS_SHOWN = 3;

export function MonthCard({ data }: { data: MonthCardData }) {
  const nameSize = data.monthName.length <= 6 ? 136 : data.monthName.length <= 8 ? 124 : 108;

  return (
    <div className="absolute inset-0">
      {/* Halo azul discreto atrás do calendário (gradiente, não filter). */}
      <div
        aria-hidden
        className="absolute top-[380px] left-[-160px] size-[1100px] bg-radial from-brand-blue/25 to-transparent to-65%"
      />

      <div className="absolute inset-x-[90px] top-[270px] bottom-[250px] flex flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-[16px]">
            <BrandSymbol title="" aria-hidden className="size-[60px] text-brand-paper" />
            <BrandWordmark className="text-[44px] leading-none" />
          </div>
          <p className="num text-[24px] tracking-[0.24em] uppercase opacity-85">
            Resumo do mês{data.partial && ` · até ${formatShortDay(data.today)}`}
          </p>
        </header>

        <h2 className="mt-[28px] flex items-baseline gap-[24px]" data-testid="month-card-title">
          <span
            className="font-extrabold tracking-tight uppercase italic"
            style={{ fontSize: nameSize, lineHeight: 0.95 }}
          >
            {data.monthName}
          </span>
          <span className="num text-[52px] font-medium opacity-85">{data.year}</span>
        </h2>

        <div className="mt-[32px] flex items-start justify-between gap-[40px]">
          <Calendar data={data} />
          <ControlColumn data={data} />
        </div>

        <dl className="mt-[32px] grid grid-cols-3 border-y-2 border-brand-paper/25">
          <Stat label="Treinos" value={formatInt(data.workouts)} />
          <Stat label="Volume · kg" value={formatInt(Math.round(data.volumeKg))} border />
          <Stat label="Recordes" value={formatInt(data.prs)} border marker={data.prs > 0} />
        </dl>

        <div className="mt-[20px] flex items-baseline justify-between gap-[24px]" data-testid="month-card-adherence">
          <p className="text-[30px] opacity-85">Adesão alimentar</p>
          {data.adherence ? (
            <p className="flex items-baseline gap-[18px]">
              <span className="num text-[64px] leading-none font-semibold">{formatInt(data.adherence.pct)}%</span>
              <span className="num text-[24px] opacity-85">
                {formatInt(data.adherence.done)}/{formatInt(data.adherence.planned)} refeições
              </span>
            </p>
          ) : (
            <p className="text-[36px] font-medium opacity-85">Sem registros</p>
          )}
        </div>

        <Achievements data={data} />

        {/* Com a lista de conquistas cheia, o mote sai para não encostar na faixa de baixo. */}
        {data.achievements.length < ACHIEVEMENTS_SHOWN && (
          <p className="num mt-auto pt-[24px] text-center text-[22px] tracking-[0.32em] uppercase opacity-85">Be in control.</p>
        )}
      </div>
    </div>
  );
}

function Calendar({ data }: { data: MonthCardData }) {
  const cell = data.weeks.length > 5 ? CELL.compact : CELL.regular;
  return (
    <div className="shrink-0" data-testid="month-card-heatmap">
      <div className="mb-[10px] flex gap-[16px]">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="num text-center text-[24px] opacity-70" style={{ width: cell.w }}>
            {d}
          </span>
        ))}
      </div>
      <div className="flex flex-col" style={{ gap: cell.gap }}>
        {data.weeks.map((week, w) => (
          <div key={w} className="flex gap-[16px]">
            {week.map((day, i) =>
              day ? (
                <DayHex key={day.date} day={day} today={data.partial && day.date === data.today} size={cell} />
              ) : (
                <span key={i} style={{ width: cell.w }} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Um dia: hexágono na cor do nível; o futuro só com contorno; hoje com fio laranja. */
function DayHex({ day, today, size }: { day: MonthCardDay; today: boolean; size: { w: number; h: number } }) {
  const future = day.level === null;
  // Níveis 3 e 4 (azuis claros) pedem número grafite; os outros, off-white.
  const darkText = !future && (day.level ?? 0) >= 3;
  return (
    <span
      className="relative flex items-center justify-center"
      style={{ width: size.w, height: size.h }}
      data-date={day.date}
      data-level={future ? "future" : day.level}
    >
      <svg
        aria-hidden
        viewBox={HEX_VIEWBOX}
        className="absolute inset-0 size-full overflow-visible"
        style={{ color: future ? "var(--brand-paper)" : heatColor(day.level ?? 0) }}
      >
        <polygon
          points={HEX_POINTS}
          fill={future ? "none" : "currentColor"}
          stroke={today ? "var(--chart-2)" : future ? "currentColor" : "none"}
          strokeOpacity={future ? 0.3 : 1}
          strokeWidth={today ? 16 : 6}
        />
      </svg>
      <span className={cn("num relative text-[26px] font-medium", darkText ? "text-brand-ink" : future && "opacity-45")}>
        {day.day}
      </span>
    </span>
  );
}

/** Ao lado do calendário: dias no controle (o número do mês) e a legenda da escala. */
function ControlColumn({ data }: { data: MonthCardData }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col self-stretch" data-testid="month-card-control">
      <p className="text-[28px] leading-tight opacity-85">Dias no controle</p>
      <p className="num mt-[6px] text-[150px] leading-[0.9] font-semibold tracking-tight">{formatInt(data.controlDays)}</p>
      <p className="num mt-[10px] text-[28px] opacity-85">
        de {formatInt(data.days)} {data.days === 1 ? "dia" : "dias"}
      </p>

      <div className="mt-auto">
        <p className="text-[22px] leading-snug opacity-85">Pontos por dia</p>
        <div className="mt-[8px] flex items-center gap-[6px]">
          <span className="num text-[22px] opacity-85">0</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <svg key={level} aria-hidden viewBox={HEX_VIEWBOX} className="h-[30px] w-[26px]" style={{ color: heatColor(level) }}>
              <polygon points={HEX_POINTS} fill="currentColor" />
            </svg>
          ))}
          <span className="num text-[22px] opacity-85">4</span>
        </div>
        <p className="mt-[6px] text-[22px] leading-snug opacity-85">3 ou 4 = no controle</p>
      </div>
    </div>
  );
}

function Stat({ label, value, border, marker }: { label: string; value: string; border?: boolean; marker?: boolean }) {
  return (
    <div className={cn("py-[18px]", border ? "border-l-2 border-brand-paper/25 pl-[28px]" : "pr-[28px]")}>
      <dt className="flex items-center gap-[10px] text-[26px] opacity-85">
        {marker && <span aria-hidden className="size-[16px] bg-brand-orange" />}
        {label}
      </dt>
      <dd className={cn("num mt-[6px] leading-none font-semibold tracking-tight", value.length > 6 ? "text-[56px]" : "text-[72px]")}>
        {value}
      </dd>
    </div>
  );
}

function Achievements({ data }: { data: MonthCardData }) {
  // O total vai no título; a lista mostra as primeiras.
  const shown = data.achievements.slice(0, ACHIEVEMENTS_SHOWN);
  return (
    <section className="mt-[28px]" data-testid="month-card-achievements">
      <h3 className="num text-[24px] tracking-[0.24em] uppercase opacity-85">
        Conquistas do mês{data.achievements.length > 0 && ` · ${data.achievements.length}`}
      </h3>
      {shown.length === 0 ? (
        <p className="mt-[14px] text-[32px] opacity-85">
          Nenhuma nova em {data.monthName}
          {data.partial ? `, por enquanto` : ""}.
        </p>
      ) : (
        <ul className="mt-[10px]">
          {shown.map((a) => (
            <li key={a.key} className="flex h-[58px] items-center gap-[20px] border-b border-brand-paper/20">
              <svg aria-hidden viewBox={HEX_VIEWBOX} className="h-[38px] w-[33px] shrink-0 text-brand-orange">
                <polygon points={HEX_POINTS} fill="currentColor" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-[36px] font-bold">{a.title}</span>
              <span className="num shrink-0 text-[26px] uppercase opacity-85">{formatShortDay(a.unlockedOn)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
