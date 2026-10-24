"use client";

import { Activity, Calculator, Save, Scale } from "lucide-react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Segmented } from "@/features/progress/components/chart-card";
import { useBmrInput } from "@/features/composition/hooks";
import { useBodyWeights } from "@/features/progress/hooks";
import { useToday } from "@/features/progress/use-today";
import {
  ACTIVITY_FACTOR,
  ACTIVITY_LEVELS,
  bmrChoice,
  FAT_G_PER_KG,
  GOAL_ADJUST,
  goalBreakdown,
  goalsFromProfile,
  KCAL_PER_G,
  MACRO_KEYS,
  PROTEIN_G_PER_KG_LEAN_DEFAULT,
  type ActivityLevel,
  type BmrChoice,
  type BmrInput,
  type BmrSourceSetting,
  type CompleteProfile,
  type Goal,
  type MacroKey,
  type Macros,
  type ProteinBasis,
  type Sex,
} from "@/features/nutrition/domain/nutrition";
import { formatKg, formatShortDay, parseDecimal } from "@/lib/format";
import { profileFormSchema } from "@/features/profile/schemas/profile";
import type { Profile } from "../api";
import { bmrSourceText } from "../bmr-view";
import { useProfile, useSaveProfile } from "../hooks";

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

const SEX_OPTIONS = [
  { value: "m", label: "Masculino" },
  { value: "f", label: "Feminino" },
] as const;

const GOAL_OPTIONS = [
  { value: "lose", label: "Perder gordura" },
  { value: "maintain", label: "Manter" },
  { value: "gain", label: "Ganhar massa" },
] as const;

const BMR_OPTIONS = [
  { value: "auto", label: "Automática" },
  { value: "scale", label: "Balança" },
  { value: "formula", label: "Fórmula" },
] as const;

const BASIS_OPTIONS = [
  { value: "weight", label: "Peso" },
  { value: "lean_mass", label: "Massa magra" },
] as const;

const GOAL_TEXT: Record<Goal, string> = { lose: "perder (−20%)", maintain: "manter (0%)", gain: "ganhar (+10%)" };

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: "Sedentário: pouco ou nenhum exercício",
  light: "Leve: exercício 1 a 3 dias por semana",
  moderate: "Moderado: exercício 3 a 5 dias por semana",
  active: "Ativo: exercício 6 a 7 dias por semana",
  very_active: "Muito ativo: treino pesado diário ou trabalho físico",
};

const MACRO_LABEL: Record<MacroKey, string> = { kcal: "kcal", protein: "Proteína (g)", carbs: "Carboidrato (g)", fat: "Gordura (g)" };

type DayKind = "rest" | "training";
type OverrideText = Record<DayKind, Record<MacroKey, string>>;

const emptyOverride = (): Record<MacroKey, string> => ({ kcal: "", protein: "", carbs: "", fat: "" });
const toText = (n: number | undefined | null) => (typeof n === "number" ? String(n).replace(".", ",") : "");

/** Conteúdo de /perfil/dados: dados corporais, conta das metas e ajuste manual. */
export function ProfileDataForm() {
  const profile = useProfile();
  const weights = useBodyWeights();
  const today = useToday();
  const bmr = useBmrInput(today);

  if (profile.isError || weights.isError || bmr.isError) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
        <p>Não foi possível carregar o perfil.</p>
        <Button variant="outline" className="h-11" onClick={() => Promise.all([profile.refetch(), weights.refetch(), bmr.refetch()])}>
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (profile.data === undefined || !weights.data || bmr.data === undefined || !today) {
    return <Skeleton className="h-[32rem] w-full rounded-xl" aria-label="Carregando perfil" />;
  }
  const last = [...weights.data].reverse().find((w) => w.day <= today) ?? weights.data.at(-1) ?? null;
  return <FormBody profile={profile.data} weight={last} today={today} bmrInput={bmr.data ?? undefined} />;
}

function FormBody({
  profile,
  weight,
  today,
  bmrInput,
}: {
  profile: Profile | null;
  weight: { day: string; weight_kg: number } | null;
  today: string;
  /** TMB e massa magra da última medição da balança (até hoje); `undefined` sem medição. */
  bmrInput: BmrInput | undefined;
}) {
  const save = useSaveProfile();
  const ids = { birth: useId(), height: useId(), activity: useId(), protein: useId(), lean: useId(), error: useId() };
  const [sex, setSex] = useState<Sex | "">(profile?.sex ?? "");
  const [birth, setBirth] = useState(profile?.birth_date ?? "");
  const [height, setHeight] = useState(toText(profile?.height_cm));
  const [activity, setActivity] = useState<ActivityLevel | "">(profile?.activity_level ?? "");
  const [goal, setGoal] = useState<Goal | "">(profile?.goal ?? "");
  const [protein, setProtein] = useState(toText(profile?.protein_g_per_kg ?? 2));
  const [bmrSource, setBmrSource] = useState<BmrSourceSetting>(profile?.bmr_source ?? "auto");
  const [proteinBasis, setProteinBasis] = useState<ProteinBasis>(profile?.protein_basis ?? "weight");
  const [proteinLean, setProteinLean] = useState(toText(profile?.protein_g_per_kg_lean ?? PROTEIN_G_PER_KG_LEAN_DEFAULT));
  const [overrides, setOverrides] = useState<OverrideText>(() => ({
    rest: { ...emptyOverride(), ...mapText(profile?.goal_overrides?.rest) },
    training: { ...emptyOverride(), ...mapText(profile?.goal_overrides?.training) },
  }));
  const [error, setError] = useState<string | null>(null);

  const parsedOverrides = {
    rest: parseOverride(overrides.rest),
    training: parseOverride(overrides.training),
  };
  const candidate = profileFormSchema.safeParse({
    sex: sex || undefined,
    birth_date: birth || undefined,
    height_cm: parseDecimal(height) ?? undefined,
    activity_level: activity || undefined,
    goal: goal || undefined,
    protein_g_per_kg: parseDecimal(protein) ?? undefined,
    goal_overrides: { rest: parsedOverrides.rest.value, training: parsedOverrides.training.value },
    bmr_source: bmrSource,
    protein_basis: proteinBasis,
    protein_g_per_kg_lean: parseDecimal(proteinLean) ?? undefined,
  });
  const complete: CompleteProfile | null = candidate.success ? candidate.data : null;
  const calc: CompleteProfile | null = complete ? { ...complete, goal_overrides: {} } : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (birth && birth > today) return setError("A data de nascimento não pode ser no futuro.");
    if (parsedOverrides.rest.invalid || parsedOverrides.training.invalid) {
      return setError("Os ajustes manuais precisam ser números entre 0 e 10000 (ou vazios).");
    }
    if (!candidate.success) return setError(candidate.error.issues[0]?.message ?? "Confira os dados.");
    setError(null);
    save.mutate(candidate.data, { onSuccess: () => toast.success("Dados salvos.") });
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Dados e metas" className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <div className="space-y-6">
        <fieldset className="space-y-4 rounded-xl border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">Dados corporais</legend>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Sexo
            </p>
            <Segmented label="Sexo" options={SEX_OPTIONS} value={sex as Sex} onChange={setSex} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={ids.birth}>Nascimento</Label>
              <Input
                id={ids.birth}
                type="date"
                value={birth}
                max={today}
                min="1900-01-01"
                onChange={(e) => setBirth(e.target.value)}
                className="num h-11 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.height}>Altura (cm)</Label>
              <Input
                id={ids.height}
                inputMode="decimal"
                autoComplete="off"
                placeholder="180"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="num h-11 text-base"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.activity}>Nível de atividade</Label>
            <select
              id={ids.activity}
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel | "")}
              className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Escolha…
              </option>
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {ACTIVITY_LABEL[level]} (× {dec.format(ACTIVITY_FACTOR[level])})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Objetivo</p>
            <Segmented label="Objetivo" options={GOAL_OPTIONS} value={goal as Goal} onChange={setGoal} />
          </div>
          <WeightLine weight={weight} />
        </fieldset>

        <fieldset className="space-y-4 rounded-xl border bg-card p-4">
          <legend className="px-1 text-sm font-semibold">Metabolismo e proteína</legend>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Fonte da TMB</p>
            <Segmented label="Fonte da TMB" options={BMR_OPTIONS} value={bmrSource} onChange={setBmrSource} />
            <BmrSourceLine choice={bmrChoice(bmrSource, today, bmrInput)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Base da proteína</p>
            <Segmented label="Base da proteína" options={BASIS_OPTIONS} value={proteinBasis} onChange={setProteinBasis} />
            {proteinBasis === "lean_mass" && (
              <p className="text-xs text-muted-foreground" data-testid="protein-basis-note">
                {bmrInput?.leanMassKg ? (
                  <>
                    Massa magra da última medição: <span className="num">{formatKg(bmrInput.leanMassKg)} kg</span>.
                  </>
                ) : (
                  "Sem massa magra medida: a proteína usa o peso até a próxima medição."
                )}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.protein}>Proteína (g por kg de peso)</Label>
            <Input
              id={ids.protein}
              inputMode="decimal"
              autoComplete="off"
              placeholder="2,0"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="num h-11 w-28 text-base"
            />
          </div>
          {proteinBasis === "lean_mass" && (
            <div className="space-y-1.5">
              <Label htmlFor={ids.lean}>Proteína (g por kg de massa magra)</Label>
              <Input
                id={ids.lean}
                inputMode="decimal"
                autoComplete="off"
                placeholder="2,5"
                value={proteinLean}
                onChange={(e) => setProteinLean(e.target.value)}
                className="num h-11 w-28 text-base"
              />
            </div>
          )}
        </fieldset>

        {error && (
          <p id={ids.error} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="h-11 w-full font-semibold sm:w-auto">
          <Save aria-hidden />
          Salvar dados
        </Button>
      </div>

      <div className="space-y-6">
        <Breakdown profile={calc} weight={weight} today={today} bmrInput={bmrInput} />
        <Overrides
          values={overrides}
          onChange={(kind, key, value) => setOverrides((o) => ({ ...o, [kind]: { ...o[kind], [key]: value } }))}
          calculated={
            calc && weight
              ? {
                  rest: goalsFromProfile(calc, weight.weight_kg, false, today, bmrInput),
                  training: goalsFromProfile(calc, weight.weight_kg, true, today, bmrInput),
                }
              : null
          }
          final={
            complete && weight
              ? {
                  rest: goalsFromProfile(complete, weight.weight_kg, false, today, bmrInput),
                  training: goalsFromProfile(complete, weight.weight_kg, true, today, bmrInput),
                }
              : null
          }
        />
      </div>
    </form>
  );
}

function mapText(o: Partial<Macros> | null | undefined): Partial<Record<MacroKey, string>> {
  if (!o) return {};
  return Object.fromEntries(MACRO_KEYS.filter((k) => typeof o[k] === "number").map((k) => [k, toText(o[k])]));
}

/** Campos de ajuste → macros informados. Vazio = usa o cálculo. */
function parseOverride(text: Record<MacroKey, string>): { value: Partial<Macros>; invalid: boolean } {
  const value: Partial<Macros> = {};
  let invalid = false;
  for (const k of MACRO_KEYS) {
    if (text[k].trim() === "") continue;
    const n = parseDecimal(text[k]);
    if (n === null || n > 10000) invalid = true;
    else value[k] = n;
  }
  return { value, invalid };
}

function WeightLine({ weight }: { weight: { day: string; weight_kg: number } | null }) {
  return (
    <p className="flex items-start gap-2 text-sm" data-testid="profile-weight">
      <Scale aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      {weight ? (
        <span>
          Peso: <span className="num font-semibold">{formatKg(weight.weight_kg)} kg</span>{" "}
          <span className="text-muted-foreground">
            (último registro, {formatShortDay(weight.day)}).{" "}
            <Link href="/evolucao" className="text-primary-text underline underline-offset-4">
              Registrar outro
            </Link>
          </span>
        </span>
      ) : (
        <span>
          Sem peso registrado.{" "}
          <Link href="/evolucao" className="font-medium text-primary-text underline underline-offset-4">
            Registre seu peso
          </Link>{" "}
          para calcular as metas.
        </span>
      )}
    </p>
  );
}

/** A conta, passo a passo, com os valores do formulário. */
function Breakdown({
  profile,
  weight,
  today,
  bmrInput,
}: {
  profile: CompleteProfile | null;
  weight: { weight_kg: number } | null;
  today: string;
  bmrInput: BmrInput | undefined;
}) {
  return (
    <section aria-labelledby="conta-titulo" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id="conta-titulo" className="flex items-center gap-2 text-sm font-semibold">
        <Calculator aria-hidden className="size-4 text-primary-text" />
        Como a meta é calculada
      </h2>
      {!profile || !weight ? (
        <p className="text-sm text-muted-foreground">
          {!weight ? "Registre seu peso e preencha" : "Preencha"} os dados corporais para ver a conta.
        </p>
      ) : (
        <BreakdownSteps profile={profile} weightKg={weight.weight_kg} today={today} bmrInput={bmrInput} />
      )}
    </section>
  );
}

export function BreakdownSteps({
  profile,
  weightKg,
  today,
  bmrInput,
}: {
  profile: CompleteProfile;
  weightKg: number;
  today: string;
  bmrInput?: BmrInput;
}) {
  const b = goalBreakdown(profile, weightKg, today, bmrInput);
  const w = formatKg(weightKg);
  const h = dec.format(profile.height_cm);
  const sexTerm = profile.sex === "m" ? "+ 5" : "− 161";
  const rest = goalsFromProfile(profile, weightKg, false, today, bmrInput);
  const training = goalsFromProfile(profile, weightKg, true, today, bmrInput);
  const lean = bmrInput?.leanMassKg;
  const steps: [string, string][] = [
    b.bmrSource === "scale"
      ? [`TMB (balança${b.bmrDate ? `, ${shortDate(b.bmrDate)}` : ""})`, `${int.format(b.bmr)} kcal medidos pela balança`]
      : ["TMB (Mifflin-St Jeor)", `10 × ${w} + 6,25 × ${h} − 5 × ${b.age} ${sexTerm} = ${int.format(b.bmr)} kcal`],
    ["Gasto diário", `${int.format(b.bmr)} × ${dec.format(b.factor)} = ${int.format(b.tdee)} kcal`],
    ["Objetivo", `${GOAL_TEXT[profile.goal]}: ${int.format(b.tdee)} × ${dec.format(1 + GOAL_ADJUST[profile.goal])} = ${int.format(b.kcal)} kcal`],
    b.proteinBasis === "lean_mass" && lean
      ? [
          "Proteína (massa magra)",
          `${dec.format(profile.protein_g_per_kg_lean ?? PROTEIN_G_PER_KG_LEAN_DEFAULT)} g/kg × ${formatKg(lean)} kg = ${int.format(b.protein)} g`,
        ]
      : ["Proteína", `${dec.format(profile.protein_g_per_kg)} g/kg × ${w} kg = ${int.format(b.protein)} g`],
    [
      "Gordura",
      `maior entre ${dec.format(FAT_G_PER_KG)} g/kg × ${w} kg = ${int.format(b.fatPerKg)} g e 20% das kcal = ${int.format(b.fatMin)} g → ${int.format(b.fat)} g`,
    ],
    [
      "Carboidrato",
      `(${int.format(b.kcal)} − ${int.format(b.protein)} × ${KCAL_PER_G.protein} − ${int.format(b.fat)} × ${KCAL_PER_G.fat}) ÷ ${KCAL_PER_G.carbs} = ${int.format(b.carbs)} g`,
    ],
    ["Dia de treino", `carboidrato +10% → ${int.format(training.carbs)} g e ${int.format(training.kcal)} kcal`],
  ];
  return (
    <>
      <dl className="space-y-2 text-sm" data-testid="goal-breakdown">
        {steps.map(([term, value]) => (
          <div key={term}>
            <dt className="text-xs text-muted-foreground">{term}</dt>
            <dd className="num">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        Sem ajuste manual: {int.format(rest.kcal)} kcal no dia sem treino. Idade: {b.age} anos.
      </p>
    </>
  );
}

const shortDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** "TMB: balança (19/10)" ou "TMB: fórmula", com a explicação (inclusive quando caiu na fórmula). */
export function BmrSourceLine({ choice }: { choice: BmrChoice }) {
  const { title, detail } = bmrSourceText(choice);
  return (
    <p className="flex items-start gap-2 text-sm" data-testid="bmr-source" data-source={choice.source} data-reason={choice.reason}>
      <Activity aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span>
        <span className="font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </p>
  );
}

function Overrides({
  values,
  onChange,
  calculated,
  final,
}: {
  values: OverrideText;
  onChange: (kind: DayKind, key: MacroKey, value: string) => void;
  calculated: Record<DayKind, Macros> | null;
  final: Record<DayKind, Macros> | null;
}) {
  const baseId = useId();
  const days: [DayKind, string][] = [
    ["rest", "Dia sem treino"],
    ["training", "Dia de treino"],
  ];
  return (
    <section aria-labelledby={`${baseId}-titulo`} className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 id={`${baseId}-titulo`} className="text-sm font-semibold">
          Metas e ajuste manual
        </h2>
        <p className="text-xs text-muted-foreground">
          Deixe vazio para usar o cálculo. Um valor digitado substitui só aquele macro.
        </p>
      </div>
      {days.map(([kind, title]) => (
        <fieldset key={kind} className="space-y-2">
          <legend className="text-sm font-medium">{title}</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MACRO_KEYS.map((key) => {
              const id = `${baseId}-${kind}-${key}`;
              return (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={id} className="text-xs">
                    {MACRO_LABEL[key]}
                    <span className="sr-only"> ({title.toLowerCase()})</span>
                  </Label>
                  <Input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={calculated ? int.format(calculated[kind][key]) : "—"}
                    value={values[kind][key]}
                    onChange={(e) => onChange(kind, key, e.target.value)}
                    className="num h-11 text-base"
                  />
                </div>
              );
            })}
          </div>
          {final && (
            <p className="num text-sm" data-testid={`goals-${kind}`}>
              Meta: <span className="font-semibold">{int.format(final[kind].kcal)} kcal</span> · P {int.format(final[kind].protein)} g · C{" "}
              {int.format(final[kind].carbs)} g · G {int.format(final[kind].fat)} g
            </p>
          )}
        </fieldset>
      ))}
    </section>
  );
}
