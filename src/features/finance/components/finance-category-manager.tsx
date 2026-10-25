"use client";

import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FinanceCategory } from "../api";
import { BUCKET_LABELS, defaultFinanceCategoryColor, SUB_BUCKET_LABELS } from "../domain/finance";
import { useCreateFinanceCategory, useDeleteFinanceCategory, useSetFinanceCategoryPreference, useUpdateFinanceCategory } from "../hooks";
import { financeCategorySchema } from "../schemas/finance";
import { categoryIcon } from "./finance-rows";

const fieldClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 md:text-sm";
type Bucket = "fixed" | "freedom" | "variable";
type SubBucket = "comfort" | "pleasures" | "knowledge" | "goals";

export function FinanceCategoryManager({ open, onOpenChange, categories }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
}) {
  const create = useCreateFinanceCategory();
  const update = useUpdateFinanceCategory();
  const setPreference = useSetFinanceCategoryPreference();
  const remove = useDeleteFinanceCategory();
  const [editing, setEditing] = useState<FinanceCategory | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [bucket, setBucket] = useState<Bucket>("variable");
  const [subBucket, setSubBucket] = useState<SubBucket>("comfort");
  const [color, setColor] = useState(defaultFinanceCategoryColor("nova categoria"));

  function startEdit(category: FinanceCategory) {
    setEditing(category);
    setName(category.name);
    setKind(category.kind as "income" | "expense");
    setBucket((category.bucket as Bucket | null) ?? "variable");
    setSubBucket((category.sub_bucket as SubBucket | null) ?? "comfort");
    setColor(category.color);
  }

  function resetForm() {
    setEditing(null);
    setName("");
    setKind("expense");
    setBucket("variable");
    setSubBucket("comfort");
    setColor(defaultFinanceCategoryColor("nova categoria"));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const categoryKind = editing ? (editing.kind as "income" | "expense") : kind;
    const parsed = financeCategorySchema.safeParse({
      name: editing?.is_default ? editing.name : name,
      kind: categoryKind,
      bucket: categoryKind === "income" ? null : bucket,
      sub_bucket: categoryKind === "income" || bucket !== "variable" ? null : subBucket,
      color,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "Revise os dados da categoria.");

    try {
      if (editing?.is_default) {
        await setPreference.mutateAsync({ id: editing.id, color: parsed.data.color });
      } else if (editing) {
        await update.mutateAsync({ id: editing.id, ...parsed.data });
      } else {
        await create.mutateAsync({ id: crypto.randomUUID(), ...parsed.data });
      }
      toast.success(editing ? "Categoria atualizada." : "Categoria criada.");
      resetForm();
    } catch {
      // A mutação já exibe o erro com a mensagem devolvida pela camada de dados.
    }
  }

  async function toggleActive(category: FinanceCategory) {
    try {
      await setPreference.mutateAsync({ id: category.id, is_active: !category.is_active });
      toast.success(category.is_active ? "Categoria desativada. O histórico foi preservado." : "Categoria ativada.");
    } catch {
      // A mutação já exibe a mensagem de erro.
    }
  }

  async function deleteCategory(category: FinanceCategory) {
    if (!window.confirm(`Excluir a categoria “${category.name}”? Essa ação não pode ser desfeita.`)) return;
    try {
      await remove.mutateAsync(category.id);
      if (editing?.id === category.id) resetForm();
      toast.success("Categoria excluída.");
    } catch {
      // A mutação já explica quando a categoria precisa ser desativada por estar em uso.
    }
  }

  const busy = create.isPending || update.isPending || setPreference.isPending;
  const custom = categories.filter((category) => !category.is_default);
  const defaults = categories.filter((category) => category.is_default);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tags aria-hidden className="size-5" />Categorias financeiras</DialogTitle>
          <DialogDescription>Crie categorias, escolha a cor usada no ícone e no gráfico, ou desative as que não usa.</DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
          <h3 className="font-semibold">{editing ? `Editar ${editing.name}` : "Nova categoria"}</h3>
          {!editing?.is_default && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <label className="space-y-1 text-sm font-medium">Nome<input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Ex.: Transporte por aplicativo" /></label>
              <label className="space-y-1 text-sm font-medium">Tipo<select className={fieldClass} value={kind} disabled={!!editing} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="expense">Saída</option><option value="income">Entrada</option></select></label>
            </div>
          )}
          {(!editing?.is_default && kind === "expense") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm font-medium">Caixa<select className={fieldClass} value={bucket} onChange={(event) => setBucket(event.target.value as Bucket)}>{Object.entries(BUCKET_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              {bucket === "variable" && <label className="space-y-1 text-sm font-medium">Subcaixa<select className={fieldClass} value={subBucket} onChange={(event) => setSubBucket(event.target.value as SubBucket)}>{Object.entries(SUB_BUCKET_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm font-medium">Cor da categoria<input aria-label="Cor da categoria" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="block h-11 w-16 cursor-pointer rounded-md border border-input bg-background p-1" /></label>
            <span className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm" style={{ color, borderColor: color }}><span className="grid size-7 place-items-center rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }}><Tags aria-hidden className="size-4" /></span>Prévia do ícone</span>
            <div className="ml-auto flex gap-2">
              {editing && <Button type="button" variant="outline" className="h-11" onClick={resetForm}><X aria-hidden className="size-4" />Cancelar</Button>}
              <Button type="submit" className="h-11" disabled={busy}><Check aria-hidden className="size-4" />{editing ? "Salvar" : <><Plus aria-hidden className="size-4" />Adicionar</>}</Button>
            </div>
          </div>
        </form>

        <CategoryList title="Suas categorias" categories={custom} editingId={editing?.id} onEdit={startEdit} onToggle={toggleActive} onDelete={deleteCategory} />
        <CategoryList title="Categorias padrão" description="Você pode personalizar a cor e desativá-las; os lançamentos existentes mantêm o histórico." categories={defaults} editingId={editing?.id} onEdit={startEdit} onToggle={toggleActive} onDelete={deleteCategory} />
      </DialogContent>
    </Dialog>
  );
}

function CategoryList({ title, description, categories, editingId, onEdit, onToggle, onDelete }: {
  title: string;
  description?: string;
  categories: FinanceCategory[];
  editingId?: string;
  onEdit: (category: FinanceCategory) => void;
  onToggle: (category: FinanceCategory) => void;
  onDelete: (category: FinanceCategory) => void;
}) {
  return (
    <section className="space-y-2">
      <header><h3 className="font-semibold">{title} <span className="text-sm font-normal text-muted-foreground">{categories.length}</span></h3>{description && <p className="text-xs text-muted-foreground">{description}</p>}</header>
      {categories.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Nenhuma categoria personalizada ainda.</p> : (
        <ul className="divide-y rounded-xl border">
          {categories.map((category) => {
            const Icon = categoryIcon(category.name);
            return <li key={category.id} className={`flex min-w-0 items-center gap-2 p-2.5 ${category.is_active ? "" : "opacity-60"}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full" style={{ color: category.color, backgroundColor: `color-mix(in srgb, ${category.color} 16%, transparent)` }}><Icon aria-hidden className="size-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{category.name}</p><p className="text-xs text-muted-foreground">{category.kind === "income" ? "Entrada" : "Saída"}{!category.is_active ? " · desativada" : ""}</p></div>
              <span className="hidden text-xs text-muted-foreground sm:inline">{category.color}</span>
              <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" aria-label={`Editar cor e dados de ${category.name}`} aria-pressed={editingId === category.id} onClick={() => onEdit(category)}><Pencil aria-hidden className="size-4" /></Button>
              <Button type="button" variant="outline" className="h-10 shrink-0 px-2.5 text-xs sm:px-3" onClick={() => onToggle(category)}>{category.is_active ? "Desativar" : "Ativar"}</Button>
              {!category.is_default && <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${category.name}`} onClick={() => onDelete(category)}><Trash2 aria-hidden className="size-4" /></Button>}
            </li>;
          })}
        </ul>
      )}
    </section>
  );
}
