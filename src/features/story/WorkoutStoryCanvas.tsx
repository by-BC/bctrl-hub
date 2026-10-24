import type { ReactNode, Ref } from "react";
import { MuscleMap } from "@musclemap/react";
import type { MuscleGroup, MuscleMapValues } from "@musclemap/core";
import maleBack from "@musclemap/assets/bodies/male-back.webp";
import maleFront from "@musclemap/assets/bodies/male-front.webp";
import type { StoryData, StoryPr } from "@/features/story/domain/story";
import { StoryFrame } from "./StoryFrame";
import { STORY_LAYOUTS } from "./layouts";
import type { StoryPhoto } from "./types";

export const WORKOUT_STORY_MODELS = ["Pôster", "Replay", "Recordes", "Adesivo", "Mapa muscular", "Sequência", "PR do dia", "Recibo", "Hex Week", "Blueprint", "Foto + overlay"] as const;
export type WorkoutStoryModel = (typeof WORKOUT_STORY_MODELS)[number];
export type WorkoutStoryOptions = {
  volume: boolean;
  duration: boolean;
  sets: boolean;
  exercises: boolean;
  records: boolean;
  caption: string;
};

export function WorkoutStoryCanvas({
  data,
  date,
  model,
  options,
  photo,
  photoMode,
  ref,
}: {
  data: StoryData;
  date: string;
  model: WorkoutStoryModel;
  options: WorkoutStoryOptions;
  photo: StoryPhoto | null;
  photoMode: boolean;
  ref: Ref<HTMLDivElement>;
}) {
  const legacyLayout = STORY_LAYOUTS.find((layout) => layout.name === model);
  return (
    <StoryFrame transparent={!legacyLayout} tone={legacyLayout?.tone} ref={ref}>
      {!legacyLayout && photoMode && photo && (
        <>
          {/* A imagem já foi reduzida e convertida em dataURL local. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt="" aria-hidden className="absolute inset-0 z-0 size-full object-cover" style={{ objectPosition: `${photo.x}% ${photo.y}%`, transform: `scale(${photo.zoom})` }} />
          <div aria-hidden className="absolute inset-0 z-0 bg-gradient-to-t from-brand-ink/80 via-brand-ink/25 to-brand-ink/20" />
        </>
      )}
      <div className="relative z-10 h-full">
        {legacyLayout ? <legacyLayout.Component data={data} photo={legacyLayout.id === "foto" && photoMode ? photo : null} /> : (
          <>
            {model === "Pôster" && <SessionPoster data={data} date={date} options={options} />}
            {model === "Replay" && <SessionReplay data={data} date={date} options={options} photoMode={photoMode} />}
            {model === "Recordes" && <RecordsPoster data={data} date={date} options={options} />}
            {model === "Adesivo" && <SessionSticker data={data} date={date} options={options} />}
            {model === "Mapa muscular" && <MuscleMapPoster data={data} date={date} />}
            {model === "Sequência" && <SessionSequence data={data} date={date} options={options} />}
            {model === "PR do dia" && <PrSticker data={data} date={date} />}
          </>
        )}
      </div>
    </StoryFrame>
  );
}

function MuscleMapPoster({ data, date }: { data: StoryData; date: string }) {
  const activeGroups = new Set(data.muscles.flatMap(muscleGroups));
  const values = Object.fromEntries([...activeGroups].map((group) => [group, { score: 88 }])) as MuscleMapValues;

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-[64px] pb-[260px] pt-[270px] text-brand-paper">
      <div aria-hidden className="absolute left-1/2 top-[790px] size-[780px] -translate-x-1/2 rounded-full bg-brand-orange/10 blur-[120px]" />
      <div className="relative">
        <p className="text-[23px] font-bold uppercase tracking-[.24em] text-brand-orange">SESSÃO · {date}</p>
        <h2 className="mt-4 text-[76px] font-black leading-[.9] tracking-[-.055em]">MAPA MUSCULAR<span className="text-brand-orange">.</span></h2>
        <p className="mt-4 line-clamp-1 text-[34px] font-semibold text-brand-paper/70">{data.routineName}</p>
      </div>
      <div className="relative mt-6 flex min-h-0 flex-1 items-center justify-center border-y border-brand-paper/15 py-3">
        <MuscleMap
          values={values}
          view="BOTH"
          colorModel="FREQUENCY"
          monochromeColor="#ed6a36"
          monochromeBaseColor="#747984"
          figureWidth={448}
          backgroundImageFront={maleFront}
          backgroundImageBack={maleBack}
          backgroundOpacity={0.78}
          backgroundGrayscale
          backgroundBrightness={0.86}
          glow={false}
          showLegend={false}
          tooltipFields={[]}
          labels={MUSCLE_GROUP_LABELS}
          style={{ width: "100%", gap: 0, pointerEvents: "none" }}
        />
      </div>
      <div className="relative mt-6 border-t border-brand-paper/25 pt-5">
        <p className="text-[22px] font-bold uppercase tracking-[.2em] text-brand-paper/55">GRUPOS TRABALHADOS</p>
        {data.muscles.length > 0 ? <div className="mt-3 flex flex-wrap gap-3">{data.muscles.slice(0, 8).map((name) => <span key={name} className="rounded-full border border-brand-orange/55 bg-brand-orange/10 px-4 py-2 text-[27px] font-bold">{name}</span>)}</div> : <p className="mt-3 text-[25px] text-brand-paper/70">Adicione os grupos musculares aos exercícios para ver o mapa.</p>}
      </div>
      <p className="num relative mt-auto border-t border-brand-paper/25 pt-5 text-[22px] font-bold uppercase tracking-[.18em] text-brand-paper/55">{data.setsCount} SÉRIES · TREINO CONCLUÍDO</p>
    </div>
  );
}

const MUSCLE_GROUP_LABELS: Partial<Record<MuscleGroup, string>> = {
  CHEST: "Peito", BACK_UPPER: "Costas", BACK_LOWER: "Lombar", TRAPEZIUS: "Trapézio", RHOMBOIDS: "Romboides", LATS: "Dorsais",
  SHOULDERS_FRONT: "Ombro frontal", SHOULDERS_SIDE: "Ombro lateral", SHOULDERS_REAR: "Ombro posterior", BICEPS: "Bíceps", TRICEPS: "Tríceps",
  FOREARMS: "Antebraço", CORE: "Abdômen", OBLIQUES: "Oblíquos", GLUTES: "Glúteos", QUADS: "Quadríceps", HAMSTRINGS: "Posterior de coxa",
  CALVES: "Panturrilha", HIP_FLEXORS: "Flexores do quadril", ADDUCTORS: "Adutores", ABDUCTORS: "Abdutores",
};

const FULL_BODY_GROUPS: MuscleGroup[] = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

function muscleGroups(value: string): MuscleGroup[] {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const regions: Record<string, MuscleGroup[]> = {
    peito: ["CHEST"], peitoral: ["CHEST"], costas: ["BACK_UPPER", "BACK_LOWER", "TRAPEZIUS", "RHOMBOIDS", "LATS"], dorsais: ["LATS"], lombar: ["BACK_LOWER"], trapezio: ["TRAPEZIUS"], romboides: ["RHOMBOIDS"],
    ombro: ["SHOULDERS_FRONT", "SHOULDERS_SIDE", "SHOULDERS_REAR"], ombros: ["SHOULDERS_FRONT", "SHOULDERS_SIDE", "SHOULDERS_REAR"], biceps: ["BICEPS"], triceps: ["TRICEPS"], antebraco: ["FOREARMS"],
    abdomen: ["CORE", "OBLIQUES"], abdominal: ["CORE"], obliquos: ["OBLIQUES"], quadriceps: ["QUADS"], coxas: ["QUADS", "HAMSTRINGS", "ADDUCTORS", "ABDUCTORS"],
    "posterior de coxa": ["HAMSTRINGS"], isquiotibiais: ["HAMSTRINGS"], gluteos: ["GLUTES"], panturrilha: ["CALVES"], gemeos: ["CALVES"], adutores: ["ADDUCTORS"], abdutores: ["ABDUCTORS"],
    "flexores do quadril": ["HIP_FLEXORS"], "corpo inteiro": FULL_BODY_GROUPS,
  };
  return regions[key] ?? [];
}

function SessionSequence({ data, date, options }: { data: StoryData; date: string; options: WorkoutStoryOptions }) {
  const exercises = data.exercises.slice(0, 5);
  return (
    <div className="relative flex h-full flex-col overflow-hidden px-[78px] pb-[270px] pt-[270px] text-brand-paper">
      <p className="text-[24px] font-bold uppercase tracking-[.24em] text-brand-orange">SUA SESSÃO · {date}</p>
      <h2 className="mt-8 text-[96px] font-black leading-[.84] tracking-[-.07em]">DO<br />PRIMEIRO<br />AO ÚLTIMO<span className="text-brand-orange">.</span></h2>
      <p className="mt-7 text-[38px] font-semibold">{data.routineName}</p>
      <ol className="relative mt-12 border-l-[4px] border-brand-orange/70 pl-8">
        {exercises.map((exercise, index) => <li key={exercise.name} className="relative border-b border-brand-paper/20 py-5 first:pt-0 last:border-0">
          <span className="absolute -left-[51px] top-5 flex size-10 items-center justify-center rounded-full border-2 border-brand-ink bg-brand-orange text-[20px] font-black text-brand-ink">{index + 1}</span>
          <p className="line-clamp-2 text-[29px] font-bold leading-tight">{exercise.name}</p>
          <p className="num mt-2 text-[22px] font-semibold uppercase tracking-[.1em] text-brand-paper/65">{exercise.sets.length} séries · melhor {exercise.best.kg} kg × {exercise.best.reps}</p>
        </li>)}
        {data.hiddenExercises > 0 && <li className="pt-5 text-[22px] font-bold uppercase tracking-[.1em] text-brand-orange">+ {data.hiddenExercises} exercícios</li>}
      </ol>
      <div className="mt-auto flex gap-7 border-t border-brand-paper/30 pt-5 text-[22px] font-bold uppercase tracking-[.1em]">{options.duration && <span>{data.durationMin} min</span>}{options.sets && <span>{data.setsCount} séries</span>}{options.volume && <span>{data.volumeKg.toLocaleString("pt-BR")} kg</span>}</div>
      {options.caption && <p className="mt-5 text-[25px] font-semibold">{options.caption}</p>}
    </div>
  );
}

function PrSticker({ data, date }: { data: StoryData; date: string }) {
  const pr = data.prs[0];
  const exercise = pr?.exercise ?? data.exercises[0]?.name;
  const value = pr ? `${pr.kg} kg × ${pr.reps}` : data.exercises[0] ? `${data.exercises[0].best.kg} kg × ${data.exercises[0].best.reps}` : "TREINO FEITO";
  return (
    <div className="flex h-full items-center justify-center px-[90px] pb-[270px] pt-[270px]">
      <div className="relative w-full -rotate-3 rounded-[56px] border-[7px] border-brand-paper bg-brand-orange px-12 py-14 text-brand-ink shadow-[24px_26px_0_rgba(0,0,0,0.35)]">
        <span className="absolute -right-6 -top-9 flex size-[132px] rotate-12 items-center justify-center rounded-full border-[6px] border-brand-ink bg-brand-paper text-[30px] font-black leading-none">{pr ? "NOVO\nPR" : "SÉRIE\nTOP"}</span>
        <p className="text-[25px] font-black uppercase tracking-[.2em]">{date} · {data.routineName}</p>
        <h2 className="mt-10 text-[84px] font-black leading-[.84] tracking-[-.07em]">{pr ? "RECORDE" : "DESTAQUE"}<br />DO DIA<span className="text-brand-paper">!</span></h2>
        <p className="mt-10 line-clamp-3 break-words border-t-[3px] border-brand-ink/25 pt-7 text-[44px] font-black leading-tight">{exercise ?? "Cada treino conta"}</p>
        <p className="num mt-6 text-[76px] font-black leading-none tracking-[-.06em]">{value}</p>
        <p className="mt-10 text-[23px] font-bold uppercase tracking-[.2em]">{pr ? "MARCA PESSOAL" : "SESSÃO CONCLUÍDA"}</p>
      </div>
    </div>
  );
}

function SessionPoster({ data, date, options }: { data: StoryData; date: string; options: WorkoutStoryOptions }) {
  const hero = options.volume && data.volumeKg > 0
    ? { value: data.volumeKg.toLocaleString("pt-BR"), unit: "KG" }
    : options.sets
      ? { value: String(data.setsCount), unit: "SÉRIES" }
      : { value: "TREINO", unit: "FEITO" };
  const exerciseCount = data.exercises.length + data.hiddenExercises;

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-[88px] pb-[270px] pt-[285px] text-brand-paper">
      <div aria-hidden className="absolute -right-[260px] top-[515px] size-[760px] rounded-full border-[3px] border-brand-paper/15" />
      <div aria-hidden className="absolute -right-[180px] top-[595px] size-[600px] rounded-full border-[3px] border-brand-paper/15" />
      <div aria-hidden className="absolute right-[102px] top-[845px] size-[110px] rounded-full bg-brand-orange" />
      <div className="relative flex items-center justify-between border-t-2 border-brand-paper/40 pt-5 text-[23px] font-bold uppercase tracking-[.2em]">
        <span>BCTRL / TRAINING LOG</span><span>№ 01</span>
      </div>
      <div className="relative mt-[105px]">
        <p className="text-[30px] font-bold uppercase tracking-[.24em] text-brand-paper/75">Sessão concluída · {date}</p>
        <h2 className="mt-8 line-clamp-3 break-words text-[94px] font-black leading-[.92] tracking-[-.045em]">{data.routineName}</h2>
      </div>
      <div className="relative mt-auto flex items-end gap-5 pb-10">
        <span className="num text-[174px] font-black leading-[.78] tracking-[-.08em]">{hero.value}</span>
        <span className="pb-1 text-[34px] font-black leading-none tracking-[.1em]">{hero.unit}</span>
      </div>
      {options.exercises && data.exercises.length > 0 && (
        <p className="relative mb-6 line-clamp-1 text-[23px] font-semibold uppercase tracking-[.11em] text-brand-paper/75">
          {data.exercises.slice(0, 3).map((exercise) => exercise.name).join(" · ")}
        </p>
      )}
      <div className="relative flex items-end justify-between border-t-2 border-brand-paper/40 pt-6">
        <div className="flex gap-8">
          {options.duration && <PosterStat value={`${data.durationMin}`} label="min" />}
          {options.sets && <PosterStat value={`${data.setsCount}`} label="séries" />}
          {options.exercises && <PosterStat value={`${exerciseCount}`} label="exercícios" />}
        </div>
        {options.records && <div className="-rotate-6 rounded-full bg-brand-orange px-5 py-4 text-[22px] font-black uppercase leading-tight text-brand-ink">{data.prs.length > 0 ? `${data.prs.length} PR${data.prs.length > 1 ? "s" : ""}` : "consistência"}</div>}
      </div>
      {options.caption && <p className="relative mt-8 text-[25px] font-bold uppercase tracking-[.14em]">{options.caption}</p>}
      <p className="relative mt-8 text-[19px] font-bold uppercase tracking-[.25em] text-brand-paper/70">Uma sessão de cada vez.</p>
    </div>
  );
}

function SessionReplay({ data, date, options, photoMode }: { data: StoryData; date: string; options: WorkoutStoryOptions; photoMode: boolean }) {
  const exercises = options.exercises ? data.exercises.slice(0, 4) : [];
  const hiddenExercises = data.hiddenExercises + data.exercises.length - exercises.length;
  const ink = photoMode ? "text-brand-paper" : "text-brand-ink";
  const rule = photoMode ? "border-brand-paper/45" : "border-brand-ink/20";
  return (
    <div className={`relative flex h-full flex-col overflow-hidden px-[88px] pb-[270px] pt-[285px] ${ink}`}>
      <div aria-hidden className={`absolute -right-20 top-[365px] size-[320px] rounded-full border-[36px] ${photoMode ? "border-brand-paper/20" : "border-brand-blue/10"}`} />
      <div className={`relative flex items-center justify-between border-b-2 pb-5 text-[23px] font-bold uppercase tracking-[.2em] ${rule}`}><span>SESSION / REPLAY</span><span>{date}</span></div>
      <h2 className={`relative mt-12 text-[104px] font-black leading-[.84] tracking-[-.06em] ${photoMode ? "text-brand-paper" : "text-brand-blue"}`}>REPLAY<span className="text-brand-orange">.</span></h2>
      <p className="relative mt-7 max-w-[780px] text-[38px] font-semibold leading-tight">O que ficou marcado em <span className="font-black">{data.routineName}</span></p>
      {exercises.length > 0 ? (
        <ol className={`relative mt-14 space-y-0 border-l-[3px] pl-8 ${photoMode ? "border-brand-paper/35" : "border-brand-blue/20"}`}>
          {exercises.map((exercise, i) => (
            <li key={exercise.name} className={`relative border-b py-6 first:pt-0 last:border-b-0 ${rule}`}>
              <span aria-hidden className="absolute -left-[47px] top-7 flex size-8 items-center justify-center rounded-full bg-brand-paper text-[18px] font-black text-brand-blue">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex items-start justify-between gap-5">
                <div className="min-w-0"><p className="line-clamp-2 break-words text-[31px] font-bold leading-tight">{exercise.name}</p><p className={`mt-2 text-[21px] font-semibold uppercase tracking-[.12em] ${photoMode ? "text-brand-paper/75" : "text-brand-ink/60"}`}>Melhor série</p></div>
                <p className="num shrink-0 pt-1 text-[29px] font-black">{exercise.best.kg}<span className="ml-1 text-[18px]">kg</span><br /><span className="text-[22px]">× {exercise.best.reps}</span></p>
              </div>
              {options.records && exercise.hasPr && <span className="mt-3 inline-block -rotate-2 bg-brand-orange px-3 py-1 text-[17px] font-black uppercase tracking-[.12em] text-brand-ink">Novo recorde</span>}
            </li>
          ))}
          {hiddenExercises > 0 && <li className="pt-3 text-[21px] font-bold uppercase tracking-[.12em] text-brand-blue">+ {hiddenExercises} exercício(s)</li>}
        </ol>
      ) : <p className={`relative mt-16 border-y-2 py-12 text-[30px] font-bold ${rule}`}>Sessão registrada · {data.setsCount} séries</p>}
      <div className={`relative mt-auto flex flex-wrap items-center gap-x-8 gap-y-2 border-t-2 pt-6 text-[21px] font-bold uppercase tracking-[.13em] ${rule}`}>
        {options.duration && <span>{data.durationMin} min</span>}{options.volume && <span>{data.volumeKg.toLocaleString("pt-BR")} kg</span>}{options.sets && <span>{data.setsCount} séries</span>}{options.records && data.prs.length > 0 && <span>{data.prs.length} marcas pessoais</span>}
      </div>
      {options.caption && <p className="relative mt-7 text-[24px] font-bold uppercase tracking-[.12em]">{options.caption}</p>}
    </div>
  );
}

function RecordsPoster({ data, date, options }: { data: StoryData; date: string; options: WorkoutStoryOptions }) {
  const seen = new Set<string>();
  const highlights: StoryPr[] = [];
  if (options.records) {
    for (const pr of data.prs) {
      if (seen.has(pr.exercise)) continue;
      seen.add(pr.exercise);
      highlights.push(pr);
      if (highlights.length === 3) break;
    }
  }
  const fallback = data.exercises.filter((exercise) => !highlights.some((pr) => pr.exercise === exercise.name)).slice(0, 3);
  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden px-[88px] pb-[270px] pt-[285px] text-brand-paper">
      <div aria-hidden className="absolute -left-[260px] top-[760px] size-[620px] rounded-full border-[3px] border-brand-orange/45" />
      <p className="relative text-[25px] font-bold uppercase tracking-[.25em] text-brand-orange">{date} / PERSONAL BESTS</p>
      <h2 className="relative mt-8 text-[112px] font-black leading-[.8] tracking-[-.07em]">NOVAS<br />MARCAS<span className="text-brand-orange">.</span></h2>
      <p className="relative mt-8 text-[36px] font-semibold">{data.routineName}</p>
      {highlights.length > 0 ? (
        <ol className="relative mt-16 space-y-6">
          {highlights.map((pr, index) => <li key={`${pr.exercise}-${pr.kind}`} className="flex items-start gap-5 border-t border-brand-paper/35 pt-5"><span className="num text-[32px] font-black text-brand-orange">0{index + 1}</span><div className="min-w-0 flex-1"><p className="line-clamp-2 text-[31px] font-bold leading-tight">{pr.exercise}</p><p className="mt-2 text-[25px] font-semibold text-brand-paper/75">{pr.kg} kg <span className="text-brand-orange">×</span> {pr.reps}</p></div><span className="-rotate-6 bg-brand-orange px-3 py-2 text-[16px] font-black uppercase text-brand-ink">PR</span></li>)}
        </ol>
      ) : fallback.length > 0 ? (
        <ol className="relative mt-16 space-y-6">{fallback.map((exercise, index) => <li key={exercise.name} className="flex items-start gap-5 border-t border-brand-paper/35 pt-5"><span className="num text-[32px] font-black text-brand-orange">0{index + 1}</span><div className="min-w-0 flex-1"><p className="line-clamp-2 text-[31px] font-bold leading-tight">{exercise.name}</p><p className="mt-2 text-[25px] text-brand-paper/75">{exercise.best.kg} kg × {exercise.best.reps}</p></div></li>)}</ol>
      ) : <p className="relative mt-16 border-t border-brand-paper/35 pt-6 text-[28px]">Cada treino conta. O próximo recorde começa aqui.</p>}
      <div className="relative mt-auto border-t border-brand-paper/35 pt-6 text-[22px] font-bold uppercase tracking-[.15em]">{options.duration && `${data.durationMin} min`}{options.duration && options.volume ? " · " : ""}{options.volume && `${data.volumeKg.toLocaleString("pt-BR")} kg`}{options.caption && <p className="mt-5 text-[26px] tracking-normal">{options.caption}</p>}</div>
    </div>
  );
}

function SessionSticker({ data, date, options }: { data: StoryData; date: string; options: WorkoutStoryOptions }) {
  return (
    <div className="flex h-full items-center justify-center px-[72px] pb-[270px] pt-[285px]">
      <div className="relative w-full -rotate-2 rounded-[46px] border-[5px] border-brand-paper bg-brand-blue px-10 py-12 text-brand-paper shadow-[18px_20px_0_rgba(37,39,44,0.2)]">
        <div aria-hidden className="absolute -right-5 -top-5 flex size-24 rotate-12 items-center justify-center rounded-full border-[4px] border-brand-ink bg-brand-orange text-center text-[17px] font-black uppercase leading-tight text-brand-ink">BCTRL<br />CLUB</div>
        <p className="text-[21px] font-black uppercase tracking-[.2em] text-brand-paper/75">TRAINING · {date}</p>
        <p className="mt-7 text-[34px] font-black uppercase leading-[.95]">TREINO<br />CONCLUÍDO<span className="text-brand-orange">!</span></p>
        <h2 className="mt-6 line-clamp-3 break-words text-[55px] font-black leading-[.95]">{data.routineName}</h2>
        <div className="mt-8 flex flex-wrap gap-3">
          {options.volume && data.volumeKg > 0 && <StickerChip>{data.volumeKg.toLocaleString("pt-BR")} kg</StickerChip>}
          {options.duration && <StickerChip>{data.durationMin} min</StickerChip>}
          {options.sets && <StickerChip>{data.setsCount} séries</StickerChip>}
          {options.records && data.prs.length > 0 && <StickerChip>{data.prs.length} PRs</StickerChip>}
        </div>
        {options.exercises && data.exercises[0] && <p className="mt-7 line-clamp-1 text-[21px] font-semibold text-brand-paper/80">Destaque: {data.exercises[0].name}</p>}
        {options.caption && <p className="mt-6 border-t border-brand-paper/40 pt-5 text-[24px] font-bold">{options.caption}</p>}
      </div>
    </div>
  );
}

function StickerChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border-2 border-brand-paper/55 bg-brand-ink px-4 py-2 text-[20px] font-bold">{children}</span>;
}

function PosterStat({ value, label }: { value: string; label: string }) {
  return <p className="flex flex-col gap-1"><span className="num text-[36px] font-black">{value}</span><span className="text-[18px] font-bold uppercase tracking-[.1em] text-brand-paper/75">{label}</span></p>;
}
