"use client";

import { CalendarCheck, Table2 } from "lucide-react";
import { useTheme } from "next-themes";
import {
  cloneElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { ActivityCalendar, type Activity, type BlockElement } from "react-activity-calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/features/progress/components/chart-card";
import { useToday } from "@/features/progress/use-today";
import {
  controlText,
  heatColor,
  heatmapDays,
  heatmapMonths,
  heatmapRange,
  monthLabel,
  scoreText,
  type HeatDay,
} from "@/features/profile/domain/month-view";
import { addDays } from "@/lib/domain/stats";
import { formatDay } from "@/lib/format";
import { useDailyScores } from "../hooks";

// Geometria do calendário (px): 12 + 4 de vão, como o do GitHub. A altura do bloco
// (rótulos dos meses + 7 linhas) é fixa, então o esqueleto ocupa exatamente o mesmo espaço.
const BLOCK = 12;
const GAP = 4;
const FONT = 12;
export const HEATMAP_HEIGHT = FONT + 8 + 7 * (BLOCK + GAP) - GAP + 2;

const LABELS = {
  months: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  // Índice 0 = domingo (convenção da biblioteca); a semana começa na segunda (`weekStart`).
  weekdays: ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"],
};

/** Texto completo de um dia (rótulo do quadrado e tooltip): data, pontuação e critérios. */
export function dayDescription(day: Pick<HeatDay, "date" | "count" | "criteria">): string {
  const met = day.criteria.length > 0 ? day.criteria.join(", ") : "nenhum critério cumprido";
  return `${formatDay(day.date)}: ${scoreText(day.count)} (${met})`;
}

/** Estilo do quadrado: cor pelo token do nível e contorno quando está em destaque. */
export function blockStyle(level: number, active: boolean, base?: CSSProperties): CSSProperties {
  return {
    ...base,
    fill: heatColor(level),
    stroke: active ? "var(--foreground)" : "var(--heat-stroke)",
    strokeWidth: active ? 2 : 1,
    outline: "none",
    cursor: "pointer",
  };
}

type Tip = { day: HeatDay; x: number; y: number };

/** Metade da largura máxima do tooltip (`max-w-56`). */
const TIP_HALF = 112;

/** Posição do tooltip no bloco: acima do centro do quadrado, presa às bordas (não vaza da tela). */
function tipPosition(wrap: Element, target: Element): { x: number; y: number } {
  const box = target.getBoundingClientRect();
  const frame = wrap.getBoundingClientRect();
  const center = box.left - frame.left + box.width / 2;
  const x = frame.width > TIP_HALF * 2 ? Math.min(Math.max(center, TIP_HALF), frame.width - TIP_HALF) : center;
  return { x, y: box.top - frame.top };
}

/**
 * Heatmap "dia no controle" dos últimos 12 meses (`react-activity-calendar`): semana de segunda
 * a domingo, nível = pontuação (0–4) em `data-level`. Passar o mouse, tocar ou focar um dia
 * mostra a data, a pontuação e os critérios. Teclado: um só ponto de Tab (o dia em foco) e
 * setas para andar (← → semana, ↑ ↓ dia). Alternativa textual: resumo e tabela por mês.
 */
export function ControlHeatmap() {
  const today = useToday();
  const from = today ? heatmapRange(today).from : null;
  const scores = useDailyScores(from, today);

  const days = useMemo(
    () => (scores.data && from && today ? heatmapDays(scores.data, from, today) : null),
    [scores.data, from, today],
  );

  return (
    <section aria-labelledby="heatmap-titulo" className="rounded-xl border bg-card p-4 lg:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="heatmap-titulo" className="flex items-center gap-2 text-lg font-semibold">
          <CalendarCheck aria-hidden className="size-5 text-primary-text" />
          Dias no controle
        </h2>
        <p className="text-xs text-muted-foreground">Últimos 12 meses · 1 ponto por critério cumprido</p>
      </div>

      {scores.isError ? (
        <div role="alert" className="space-y-3 text-sm" style={{ minHeight: HEATMAP_HEIGHT }}>
          <p>Não foi possível carregar a pontuação dos dias.</p>
          <Button variant="outline" className="h-11" onClick={() => scores.refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : !days || !today ? (
        <HeatmapSkeleton />
      ) : (
        <HeatmapBody days={days} today={today} />
      )}
    </section>
  );
}

function HeatmapSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando o heatmap">
      <Skeleton className="w-full rounded-md" style={{ height: HEATMAP_HEIGHT }} />
      <Skeleton className="mt-3 h-5 w-56" />
      <Skeleton className="mt-3 h-11 w-36" />
    </div>
  );
}

function HeatmapBody({ days, today }: { days: HeatDay[]; today: string }) {
  const { resolvedTheme } = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);
  const [focusDate, setFocusDate] = useState(today);
  const [tip, setTip] = useState<Tip | null>(null);
  const keyboardMove = useRef(false);

  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const months = useMemo(() => heatmapMonths(days), [days]);
  const first = days[0].date;
  const current = months[months.length - 1];
  const totalControl = months.reduce((n, m) => n + m.control, 0);
  const totalDays = months.reduce((n, m) => n + m.days, 0);

  // Celular: o bloco rola na horizontal sozinho; começa mostrando hoje (o fim).
  useEffect(() => {
    const scroller = wrapRef.current?.querySelector<HTMLElement>(".react-activity-calendar__scroll-container");
    if (!scroller) return;
    // Depois do quadro seguinte: a biblioteca só mede os rótulos dos dias no cliente (depois
    // de montar), o que ainda alarga a área rolável.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        scroller.scrollLeft = scroller.scrollWidth;
      });
    });
    // Ao rolar o bloco, o tooltip acompanha o quadrado (e some se ele sair da vista).
    const follow = () =>
      setTip((t) => {
        const wrap = wrapRef.current;
        const rect = wrap?.querySelector(`rect[data-date="${t?.day.date}"]`);
        if (!t || !wrap || !rect) return null;
        const box = rect.getBoundingClientRect();
        const view = scroller.getBoundingClientRect();
        if (box.right < view.left || box.left > view.right) return null;
        return { day: t.day, ...tipPosition(wrap, rect) };
      });
    scroller.addEventListener("scroll", follow, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", follow);
    };
  }, []);

  // Foco pelo teclado: leva o foco ao quadrado do novo dia (e o rola para a vista).
  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    const rect = wrapRef.current?.querySelector<SVGRectElement>(`rect[data-date="${focusDate}"]`);
    rect?.focus();
  }, [focusDate]);

  function show(date: string, target: Element) {
    const day = byDate.get(date);
    const wrap = wrapRef.current;
    if (!day || !wrap) return;
    setTip({ day, ...tipPosition(wrap, target) });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
    let next: string | null = null;
    if (e.key in step) next = addDays(focusDate, step[e.key]);
    else if (e.key === "Home") next = first;
    else if (e.key === "End") next = today;
    else if (e.key === "Escape") {
      setTip(null);
      return;
    }
    if (!next) return;
    e.preventDefault();
    if (next < first) next = first;
    if (next > today) next = today;
    if (next === focusDate) return;
    keyboardMove.current = true;
    setFocusDate(next);
  }

  function renderBlock(block: BlockElement, activity: Activity) {
    const day = byDate.get(activity.date);
    if (!day) return block;
    const active = tip?.day.date === day.date;
    return cloneElement(block, {
      role: "button",
      tabIndex: day.date === focusDate ? 0 : -1,
      "aria-label": dayDescription(day),
      "aria-describedby": active ? tipId : undefined,
      "aria-current": day.date === today ? "date" : undefined,
      "data-score": day.count,
      style: blockStyle(day.level, active, block.props.style),
      onMouseEnter: (e) => show(day.date, e.currentTarget),
      onMouseLeave: () => setTip((t) => (t?.day.date === day.date ? null : t)),
      onFocus: (e) => {
        setFocusDate(day.date);
        show(day.date, e.currentTarget);
      },
      onBlur: () => setTip((t) => (t?.day.date === day.date ? null : t)),
      onClick: (e) => {
        setFocusDate(day.date);
        show(day.date, e.currentTarget);
      },
    } as Partial<BlockElement["props"]>);
  }

  return (
    <>
      <p className="sr-only">
        {`Heatmap de ${monthLabel(first)} até hoje: ${totalControl} de ${totalDays} dias no controle (pontuação 3 ou 4). `}
        Use as setas para andar pelos dias, ou a tabela por mês logo abaixo.
      </p>
      {/* O próprio calendário rola na horizontal (a página não). */}
      <div
        ref={wrapRef}
        data-testid="control-heatmap"
        className="relative min-w-0 text-muted-foreground"
        style={{ minHeight: HEATMAP_HEIGHT }}
        onKeyDown={onKeyDown}
      >
        <ActivityCalendar
          data={days}
          weekStart={1}
          blockSize={BLOCK}
          blockMargin={GAP}
          blockRadius={2}
          fontSize={FONT}
          labels={LABELS}
          showWeekdayLabels={["mon", "wed", "fri"]}
          showTotalCount={false}
          showColorLegend={false}
          colorScheme={resolvedTheme === "light" ? "light" : "dark"}
          renderBlock={renderBlock}
        />
        {tip && (
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={{ left: tip.x, top: tip.y - 6 }}
          >
            <p className="font-semibold">{formatDay(tip.day.date)}</p>
            <p className="num mt-0.5">{scoreText(tip.day.count)}</p>
            {tip.day.criteria.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {tip.day.criteria.map((c) => (
                  <li key={c}>✓ {c}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">Nenhum critério cumprido</p>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <p className="text-sm">
          <span className="font-medium">Neste mês:</span>{" "}
          <span className="num" data-testid="heatmap-month-text">
            {controlText(current.control, current.days)}
          </span>
        </p>
        <HeatLegend />
      </div>

      <div className="mt-2 border-t pt-2">
        <Button
          variant="ghost"
          className="h-11 px-2 text-sm"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
        >
          <Table2 aria-hidden />
          {showTable ? "Ocultar tabela por mês" : "Ver tabela por mês"}
        </Button>
        {/* Rola por dentro: focável para quem usa teclado (role + nome para o leitor de tela). */}
        <div
          id={tableId}
          hidden={!showTable}
          role="region"
          aria-label="Tabela por mês"
          tabIndex={showTable ? 0 : undefined}
          className="mt-2 max-h-96 overflow-auto rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {showTable && (
            <DataTable
              caption="Dias no controle por mês, últimos 12 meses"
              columns={[
                { label: "Mês" },
                { label: "No controle (3–4 pts)", numeric: true },
                { label: "Com algum ponto", numeric: true },
                { label: "Dias", numeric: true },
              ]}
              rows={[...months].reverse().map((m) => ({
                key: m.month,
                cells: [monthLabel(m.month), m.control, m.scored, m.days],
              }))}
            />
          )}
        </div>
      </div>
    </>
  );
}

/** Legenda com o número de cada nível (a cor nunca fala sozinha). */
function HeatLegend() {
  return (
    <ul aria-label="Legenda: pontos no dia" className="flex items-center gap-2 text-xs text-muted-foreground">
      <li className="mr-0.5">Pontos</li>
      {[0, 1, 2, 3, 4].map((level) => (
        <li key={level} className="flex items-center gap-1">
          <span
            aria-hidden
            className="inline-block size-3 rounded-[2px]"
            style={{ background: heatColor(level), boxShadow: "inset 0 0 0 1px var(--heat-stroke)" }}
          />
          <span className="num">{level}</span>
        </li>
      ))}
    </ul>
  );
}
