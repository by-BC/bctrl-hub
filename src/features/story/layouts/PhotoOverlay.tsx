import { ImagePlus } from "lucide-react";
import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import { HEX_SEGMENT_POINTS } from "@/lib/domain/hex";
import { formatInt } from "@/lib/format";
import { STORY_PR_LABELS, durationShort, prValueText, storyDate } from "../format";
import type { StoryLayoutProps, StoryPhoto } from "../types";

/**
 * Foto + overlay: a foto do aparelho (dataURL local, nunca enviada) cobre o quadro, com
 * um degradê grafite para leitura. Os dados vêm numa faixa grafite com fio laranja: o
 * selo "treino concluído" em laranja (grafite negrito por cima), o nome da rotina em
 * Sora itálico gigante e três números em mono. Sem foto, um fundo de espera.
 */

export function PhotoOverlay({ data, photo }: StoryLayoutProps) {
  const date = storyDate(data.date);
  const duration = durationShort(data.durationMin);
  const nameSize = data.routineName.length <= 8 ? 150 : data.routineName.length <= 13 ? 110 : 80;
  const topPr = data.prs[0];

  return (
    <div className="absolute inset-0">
      {photo ? <Photo photo={photo} /> : <Placeholder />}

      {/* Degradês de leitura (topo para a marca; base para os dados). */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[560px] bg-linear-to-b from-brand-ink/75 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[1100px] bg-linear-to-t from-brand-ink via-brand-ink/80 via-45% to-transparent" />

      <header className="absolute top-[270px] right-[80px] left-[80px] flex items-center justify-between">
        <div className="flex items-center gap-[16px]">
          <BrandSymbol title="" aria-hidden className="size-[64px] text-brand-paper" />
          <BrandWordmark className="text-[44px] leading-none" />
        </div>
        <p className="num text-[28px] tracking-[0.2em]">{date.dotted}</p>
      </header>

      {/* A faixa grafite vai até a borda de baixo; o conteúdo termina acima dos 250 px. */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="px-[80px]">
          <p className="inline-block bg-brand-orange px-[20px] py-[6px] text-[30px] font-extrabold tracking-[0.14em] text-brand-ink uppercase">
            Treino concluído · {date.weekday}
          </p>
          <p
            className="mt-[18px] truncate font-extrabold tracking-[-0.03em] uppercase italic"
            style={{ fontSize: nameSize, lineHeight: 1 }}
          >
            {data.routineName}
          </p>
        </div>

        <div className="mt-[28px] border-t-[10px] border-brand-orange bg-brand-ink px-[80px] pt-[30px] pb-[284px]">
          <dl className="grid grid-cols-[1.4fr_1fr_1fr] gap-[28px]">
            <Stat label="Volume" value={formatInt(data.volumeKg)} unit="kg" />
            <Stat label="Tempo" value={duration.value} unit={duration.unit} />
            <Stat label="Séries" value={String(data.setsCount)} />
          </dl>
          {topPr && (
            <p className="mt-[24px] flex items-center gap-[16px] border-t-2 border-brand-paper/25 pt-[20px] text-[30px]">
              <span className="shrink-0 rounded-full bg-brand-orange px-[18px] text-[26px] leading-[44px] font-extrabold text-brand-ink uppercase">
                {data.prs.length} {data.prs.length === 1 ? "PR" : "PRs"}
              </span>
              <span className="min-w-0 truncate">
                {topPr.exercise} · {STORY_PR_LABELS[topPr.kind]}{" "}
                <span className="num font-semibold">{prValueText(topPr.kind, topPr.value)}</span>
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <dt className="num text-[22px] tracking-[0.24em] uppercase opacity-85">{label}</dt>
      <dd className="num mt-[6px] truncate text-[76px] leading-none font-semibold tracking-tight">
        {value}
        {unit && <span className="ml-[8px] text-[30px] font-medium">{unit}</span>}
      </dd>
    </div>
  );
}

function Photo({ photo }: { photo: StoryPhoto }) {
  const origin = `${photo.x}% ${photo.y}%`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- dataURL local capturado pelo html-to-image
    <img
      src={photo.src}
      alt=""
      data-story-photo
      className="absolute inset-0 size-full object-cover"
      style={{ objectPosition: origin, transform: `scale(${photo.zoom})`, transformOrigin: origin }}
    />
  );
}

/** Fundo de espera: hexágono vazado e o convite para escolher a foto. */
function Placeholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-[40px] bg-brand-ink">
      <svg aria-hidden viewBox="0 0 200 200" className="absolute top-[260px] size-[900px] text-brand-paper/10">
        <g fill="none" stroke="currentColor" strokeWidth="22">
          {Object.values(HEX_SEGMENT_POINTS).map((points) => (
            <polyline key={points} points={points} />
          ))}
        </g>
      </svg>
      <ImagePlus aria-hidden className="relative -mt-[420px] size-[120px] opacity-80" />
      <p className="relative text-[44px] font-semibold opacity-90">Escolha uma foto</p>
    </div>
  );
}
