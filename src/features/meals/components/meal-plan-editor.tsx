"use client";

import { useIsMutating } from "@tanstack/react-query";
import { Check, ChevronDown, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BackLink } from "@/features/routines/components/back-link";
import { BlurSaveField } from "@/features/routines/components/blur-save-field";
import { MoveButtons } from "@/features/routines/components/sortable-list";
import { formatMealTime } from "@/features/meals/domain/meals";
import { parseQty } from "@/features/nutrition/domain/nutrition";
import { changedPositions, moveById, nextPosition } from "@/features/routines/domain/routines";
import { mealFormSchema, mealOptionFormSchema, type MealItem } from "@/features/meals/schemas/meal";
import { firstError } from "@/features/routines/schemas/routine";
import { OptionMacros } from "@/features/nutrition/components/macro-summary";
import { useFoodsById } from "@/features/nutrition/hooks";
import type { Meal, MealOption } from "../api";
import {
  MEAL_PLAN_MUTATION_KEY,
  useCreateMeal,
  useCreateMealOption,
  useDeleteMeal,
  useDeleteMealOption,
  useMealPlan,
  useReorderMeals,
  useUpdateMeal,
  useUpdateMealOption,
} from "../hooks";
import {
  comparableNutrition,
  ItemNutrition,
  nutritionFields,
  toNutritionDraft,
  type NutritionDraft,
} from "./item-nutrition";
import { optionLabel } from "./meal-sheet";

/** Conteúdo de /comida/plano: refeições (nome, horário, só em dia de treino, ordem) e opções. */
export function MealPlanEditor() {
  const { data, isPending, isError, refetch } = useMealPlan();
  const createMeal = useCreateMeal();
  const reorder = useReorderMeals();

  const header = (
    <>
      <BackLink href="/comida" label="Comida" />
      <PageHeader title="Plano alimentar" eyebrow="Comida">
        <SaveStatus />
      </PageHeader>
    </>
  );

  if (isPending) {
    return (
      <>
        {header}
        <div aria-busy="true" aria-label="Carregando plano" className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      </>
    );
  }
  if (isError) {
    return (
      <>
        {header}
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar o plano alimentar.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      </>
    );
  }

  const meals = data;
  const move = (id: string, direction: -1 | 1) => {
    const changed = changedPositions(meals, moveById(meals, id, direction));
    if (changed.length > 0) reorder.mutate(changed.map(({ id, position }) => ({ id, position })));
  };

  return (
    <>
      {header}
      <p className="mb-4 text-sm text-muted-foreground">
        Na tela do dia, as refeições aparecem por horário. As sem horário (como o pós-treino) ficam no lugar
        definido pela ordem abaixo.
      </p>

      {meals.length === 0 ? (
        <div className="mb-4 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          Nenhuma refeição ainda. Adicione a primeira.
        </div>
      ) : (
        <ul className="mb-4 space-y-4" aria-label="Refeições do plano">
          {meals.map((meal, index) => (
            <li key={meal.id}>
              <MealEditorCard meal={meal} index={index} count={meals.length} onMove={(dir) => move(meal.id, dir)} />
            </li>
          ))}
        </ul>
      )}

      <Button
        className="h-11 font-semibold"
        onClick={() =>
          createMeal.mutate({
            id: crypto.randomUUID(),
            name: "Nova refeição",
            time: null,
            position: nextPosition(meals),
            training_day_only: false,
          })
        }
      >
        <Plus aria-hidden />
        Adicionar refeição
      </Button>
    </>
  );
}

function MealEditorCard({
  meal,
  index,
  count,
  onMove,
}: {
  meal: Meal;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
}) {
  const update = useUpdateMeal();
  const remove = useDeleteMeal();
  const createOption = useCreateMealOption();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const trainingId = useId();

  const save = (patch: Partial<Pick<Meal, "name" | "time" | "training_day_only">>) => {
    const parsed = mealFormSchema.safeParse({
      name: meal.name,
      time: formatMealTime(meal.time),
      training_day_only: meal.training_day_only,
      ...patch,
    });
    if (!parsed.success) return firstError(parsed.error);
    const clean = Object.fromEntries(Object.keys(patch).map((k) => [k, parsed.data[k as keyof typeof patch]]));
    update.mutate({ id: meal.id, patch: clean });
    return null;
  };

  return (
    <article aria-label={meal.name} data-testid="plan-meal" className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden className="num w-6 shrink-0 text-sm text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <h2 className="min-w-0 flex-1 truncate font-semibold">{meal.name}</h2>
        <MoveButtons label={meal.name} index={index} count={count} onMove={onMove} />
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <BlurSaveField label="Nome" value={meal.name} maxLength={120} onSave={(name) => save({ name })} />
        <TimeField value={formatMealTime(meal.time) ?? ""} onSave={(time) => save({ time })} />
      </div>

      <div className="flex min-h-11 items-center gap-3">
        <Checkbox
          id={trainingId}
          className="size-5"
          checked={meal.training_day_only}
          onCheckedChange={(checked) => save({ training_day_only: checked === true })}
        />
        <Label htmlFor={trainingId} className="font-normal">
          Só em dia de treino
        </Label>
      </div>

      <section aria-label={`Opções de ${meal.name}`} className="space-y-2">
        <h3 className="text-sm font-semibold">Opções</h3>
        {meal.meal_options.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem opções ainda.</p>
        )}
        <ul className="space-y-2">
          {meal.meal_options.map((option, i) => (
            <li key={option.id}>
              <OptionEditor option={option} index={i} />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="outline"
            className="h-11"
            onClick={() =>
              createOption.mutate({
                id: crypto.randomUUID(),
                meal_id: meal.id,
                position: nextPosition(meal.meal_options),
                title: optionLabel(meal.meal_options.length),
                items: [],
              })
            }
          >
            <Plus aria-hidden />
            Adicionar opção
          </Button>
          <Button
            variant="ghost"
            className="h-11 text-destructive hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden />
            Excluir refeição
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Excluir ${meal.name}?`}
        description="As opções e todos os registros desta refeição (inclusive de dias passados) serão apagados."
        confirmLabel="Excluir refeição"
        destructive
        onConfirm={() => remove.mutate(meal.id)}
      />
    </article>
  );
}

/** Horário (HH:MM) gravado ao sair do campo. Vazio = sem horário fixo. */
function TimeField({ value, onSave }: { value: string; onSave: (value: string) => string | null }) {
  const ids = { field: useId(), error: useId(), hint: useId() };
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={ids.field}>Horário</Label>
      <Input
        id={ids.field}
        type="time"
        value={draft}
        className="num h-11 text-base"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ids.error : ids.hint}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft === value) return setError(null);
          setError(onSave(draft));
        }}
      />
      {error ? (
        <p id={ids.error} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p id={ids.hint} className="text-xs text-muted-foreground">
          Vazio = sem horário fixo
        </p>
      )}
    </div>
  );
}

// ── Opção ─────────────────────────────────────────────────────────────────

type DraftItem = { key: string; name: string; qty: string; subs: string; nutrition: NutritionDraft };
type Draft = { title: string; items: DraftItem[] };

const toDraft = (option: MealOption): Draft => ({
  title: option.title,
  items: option.items.map((item) => ({
    key: crypto.randomUUID(),
    name: item.name,
    qty: item.qty,
    subs: item.subs.join("\n"),
    nutrition: toNutritionDraft(item),
  })),
});

const emptyItem = (): DraftItem => ({
  key: crypto.randomUUID(),
  name: "",
  qty: "",
  subs: "",
  nutrition: toNutritionDraft({ name: "", qty: "", subs: [] }),
});

/**
 * Nova quantidade: se o "à vontade" do item seguia o texto antigo, passa a seguir o novo
 * (digitar "à vontade" marca; trocar por "100 g" desmarca). Marcação manual é mantida.
 */
function withQty(item: DraftItem, qty: string): Partial<DraftItem> {
  const followed = item.nutrition.free === parseQty(item.qty).free;
  return { qty, nutrition: followed ? { ...item.nutrition, free: parseQty(qty).free } : item.nutrition };
}

const draftToForm = (draft: Draft) => ({
  title: draft.title,
  items: draft.items.map((i) => ({
    name: i.name,
    qty: i.qty,
    subs: i.subs.split("\n"),
    ...nutritionFields(i.qty, i.nutrition),
  })),
});

/** Comparação já normalizada (espaços e linhas vazias não contam como mudança). */
function sameAsSaved(draft: Draft, option: MealOption) {
  const norm = (title: string, items: MealItem[]) =>
    JSON.stringify({
      title: title.trim(),
      items: items.map((i) => ({
        name: i.name.trim(),
        qty: i.qty.trim(),
        subs: i.subs.map((s) => s.trim()).filter(Boolean),
        ...comparableNutrition({ ...i, qty: i.qty.trim() }),
      })),
    });
  const form = draftToForm(draft);
  return norm(form.title, form.items) === norm(option.title, option.items);
}

/**
 * Edição local com "Salvar opção": a lista de itens muda de tamanho enquanto se edita,
 * então grava tudo de uma vez (título + itens), validado.
 */
function OptionEditor({ option, index }: { option: MealOption; index: number }) {
  const update = useUpdateMealOption();
  const remove = useDeleteMealOption();
  const foods = useFoodsById();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(option));
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const titleId = useId();
  const errorId = useId();
  const label = optionLabel(index);
  const dirty = !sameAsSaved(draft, option);

  const setItem = (key: string, patch: Partial<DraftItem>) =>
    setDraft((d) => ({ ...d, items: d.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

  function saveOption() {
    const parsed = mealOptionFormSchema.safeParse(draftToForm(draft));
    if (!parsed.success) return setError(firstError(parsed.error));
    setError(null);
    update.mutate({ id: option.id, mealId: option.meal_id, patch: parsed.data });
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
      <CollapsibleTrigger className="flex min-h-12 w-full items-center gap-2 rounded-xl px-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <span className="num shrink-0 text-xs tracking-[0.15em] text-muted-foreground uppercase">{label}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.title}</span>
        <span className="num shrink-0 text-xs text-muted-foreground">
          {option.items.length} {option.items.length === 1 ? "item" : "itens"}
        </span>
        <ChevronDown aria-hidden className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="sr-only">{open ? "Recolher" : "Editar"}</span>
      </CollapsibleTrigger>
      <OptionMacros items={option.items} className="px-3 pb-2" />
      <CollapsibleContent>
        <form
          aria-label={`Editar ${label}`}
          className="space-y-4 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveOption();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={titleId}>Título da opção</Label>
            <Input
              id={titleId}
              value={draft.title}
              maxLength={120}
              autoComplete="off"
              className="h-11 text-base"
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">Itens</legend>
            {draft.items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>}
            {draft.items.map((item, i) => (
              <div key={item.key} className="space-y-2 rounded-lg bg-muted/50 p-3" data-testid="option-item">
                <div className="flex items-center justify-between gap-2">
                  <span className="num text-xs text-muted-foreground">Item {i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Remover item ${i + 1}`}
                    onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((x) => x.key !== item.key) }))}
                  >
                    <X aria-hidden />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
                  <Input
                    aria-label={`Item ${i + 1}: nome`}
                    placeholder="Alimento"
                    value={item.name}
                    maxLength={120}
                    autoComplete="off"
                    className="h-11 text-base"
                    onChange={(e) => setItem(item.key, { name: e.target.value })}
                  />
                  <Input
                    aria-label={`Item ${i + 1}: quantidade`}
                    placeholder="Quantidade"
                    value={item.qty}
                    maxLength={60}
                    autoComplete="off"
                    className="num h-11 text-base"
                    onChange={(e) => setItem(item.key, withQty(item, e.target.value))}
                  />
                </div>
                <Textarea
                  aria-label={`Item ${i + 1}: substituições, uma por linha`}
                  placeholder="Substituições (uma por linha)"
                  value={item.subs}
                  rows={2}
                  className="min-h-11 text-base"
                  onChange={(e) => setItem(item.key, { subs: e.target.value })}
                />
                <ItemNutrition
                  index={i}
                  name={item.name}
                  qty={item.qty}
                  draft={item.nutrition}
                  foods={foods}
                  onChange={(patch) => setItem(item.key, { nutrition: { ...item.nutrition, ...patch } })}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() =>
                setDraft((d) => ({ ...d, items: [...d.items, emptyItem()] }))
              }
            >
              <Plus aria-hidden />
              Adicionar item
            </Button>
          </fieldset>

          {error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" className="h-11 font-semibold" disabled={!dirty}>
              <Check aria-hidden />
              Salvar opção
            </Button>
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                className="h-11"
                onClick={() => {
                  setDraft(toDraft(option));
                  setError(null);
                }}
              >
                Descartar alterações
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              className="ml-auto h-11 text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 aria-hidden />
              Excluir opção
            </Button>
          </div>
        </form>
      </CollapsibleContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Excluir ${label}: ${option.title}?`}
        description="Dias em que você escolheu esta opção continuam marcados como feitos, sem a opção."
        confirmLabel="Excluir opção"
        destructive
        onConfirm={() => remove.mutate({ id: option.id, mealId: option.meal_id })}
      />
    </Collapsible>
  );
}

/** "Salvando…" enquanto houver gravação do plano na fila; "Salvo" depois da primeira. */
function SaveStatus() {
  const pending = useIsMutating({ mutationKey: MEAL_PLAN_MUTATION_KEY });
  const [touched, setTouched] = useState(false);
  if (pending > 0 && !touched) setTouched(true);
  if (!touched) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="save-status">
      {pending > 0 ? (
        <>
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Salvando…
        </>
      ) : (
        <>
          <Check aria-hidden className="size-3.5 text-primary-text" />
          Salvo
        </>
      )}
    </p>
  );
}
