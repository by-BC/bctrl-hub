import { BrandSymbol, BrandWordmark } from "@/components/brand/brand-symbol";
import type { DayFacts, CriterionKey } from "@/lib/domain/score";
import { formatDay, formatInt } from "@/lib/format";

const CRITERIA: readonly { key: CriterionKey; label: string; detail: (facts: DayFacts) => string }[] = [
  { key: "trained", label: "Treino ou cardio", detail: (facts) => facts.workouts > 0 ? `${formatInt(facts.workouts)} ${facts.workouts === 1 ? "treino" : "treinos"}` : facts.trained ? "Cardio registrado" : "Sem atividade registrada" },
  { key: "diet", label: "Alimentação", detail: (facts) => facts.mealsPlanned > 0 ? `${formatInt(facts.mealsDone)} de ${formatInt(facts.mealsPlanned)} refeições` : "Sem refeições previstas" },
  { key: "habits", label: "Hábitos", detail: (facts) => facts.habits ? "Meta diária cumprida" : "Não pontuou hoje" },
  { key: "tasks", label: "Tarefas", detail: (facts) => facts.tasks ? "Tarefa concluída" : "Nenhuma concluída" },
];

/** Resumo geral do dia, combinando os quatro critérios do Perfil em uma única imagem. */
export function DailyCard({ facts }: { facts: DayFacts }) {
  const controlled = facts.score >= 3;
  return (
    <div className="absolute inset-0 text-brand-paper">
      <div aria-hidden className="absolute top-[210px] right-[-220px] size-[980px] rounded-full bg-radial from-brand-blue/35 to-transparent to-70%" />
      <div className="absolute inset-x-[90px] top-[270px] bottom-[250px] flex flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-[16px]">
            <BrandSymbol title="" aria-hidden className="size-[60px] text-brand-paper" />
            <BrandWordmark className="text-[44px] leading-none" />
          </div>
          <p className="num text-[24px] tracking-[0.24em] uppercase opacity-75">Resumo do dia</p>
        </header>

        <p className="mt-[100px] text-[34px] font-medium tracking-[0.12em] text-brand-paper/75 uppercase">{formatDay(facts.day)}</p>
        <div className="mt-[28px] flex items-end gap-[26px]">
          <p className="num text-[270px] leading-[0.85] font-semibold" data-testid="daily-card-score">{facts.score}</p>
          <div className="pb-[18px]">
            <p className="text-[54px] leading-none text-brand-paper/65">/ 4</p>
            <p className="mt-[18px] max-w-[430px] text-[42px] leading-tight font-semibold">
              {controlled ? "Dia no controle" : "Um passo de cada vez"}
            </p>
          </div>
        </div>

        <div className="mt-[72px] grid grid-cols-2 gap-[20px]" data-testid="daily-card-criteria">
          {CRITERIA.map(({ key, label, detail }) => (
            <article key={key} className="min-h-[188px] rounded-[24px] border-2 border-brand-paper/20 bg-brand-paper/5 p-[24px]" data-testid={`daily-criterion-${key}`}>
              <p className="text-[25px] tracking-[0.16em] text-brand-paper/65 uppercase">{label}</p>
              <p className="mt-[20px] text-[34px] leading-tight font-semibold">{detail(facts)}</p>
              <p className="mt-[10px] text-[22px] font-medium tracking-[0.12em] text-brand-paper/55 uppercase">{facts[key] ? "Concluído" : "Sem ponto"}</p>
            </article>
          ))}
        </div>

        <dl className="mt-[36px] grid grid-cols-3 border-y-2 border-brand-paper/25 py-[26px]">
          <Stat label="Treinos" value={formatInt(facts.workouts)} />
          <Stat label="Volume · kg" value={facts.workouts ? formatInt(Math.round(facts.volumeKg)) : "—"} />
          <Stat label="Recordes" value={formatInt(facts.prs)} />
        </dl>
        <p className="num mt-auto text-center text-[22px] tracking-[0.32em] uppercase opacity-60">Be in control.</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-[20px] first:pl-0 last:pr-0 [&+div]:border-l-2 [&+div]:border-brand-paper/25">
      <dt className="text-[22px] tracking-[0.16em] text-brand-paper/65 uppercase">{label}</dt>
      <dd className="num mt-[12px] text-[40px] font-semibold">{value}</dd>
    </div>
  );
}
