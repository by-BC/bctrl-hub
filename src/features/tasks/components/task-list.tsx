"use client";

import { ChevronDown, ListChecks, Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { taskTitleSchema } from "@/features/habits/schemas/habit";
import type { Task } from "../api";
import { useDeleteTask, useSaveTask, useTasks, useToggleTask } from "../hooks";

/** Conteúdo de /tarefas: criar com 1 campo + Enter, concluir/desfazer, excluir. */
export function TaskList() {
  const { data, isPending, isError, refetch } = useTasks();
  const [doneOpen, setDoneOpen] = useState(false);

  const pending = data?.filter((t) => !t.done_at) ?? [];
  const done = (data?.filter((t) => t.done_at) ?? []).sort((a, b) => b.done_at!.localeCompare(a.done_at!));

  return (
    <>
      <PageHeader title="Tarefas" eyebrow="To-do" />
      <NewTaskForm />

      {isError ? (
        <div role="alert" className="space-y-3 rounded-xl border p-5 text-sm">
          <p>Não foi possível carregar as tarefas.</p>
          <Button variant="outline" className="h-11" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : isPending ? (
        <div aria-busy="true" aria-label="Carregando tarefas" className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="pendentes-titulo">
            <h2 id="pendentes-titulo" className="mb-2 flex items-baseline gap-2 text-sm font-semibold">
              Pendentes <span className="num font-normal text-muted-foreground">{pending.length}</span>
            </h2>
            {pending.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                <ListChecks aria-hidden className="size-4 shrink-0" />
                Nada pendente. Escreva uma tarefa acima e aperte Enter.
              </p>
            ) : (
              <ul aria-label="Tarefas pendentes" className="divide-y rounded-xl border bg-card">
                {pending.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            )}
          </section>

          {done.length > 0 && (
            <Collapsible open={doneOpen} onOpenChange={setDoneOpen} asChild>
              <section aria-label="Concluídas">
                <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 rounded-md text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <ChevronDown aria-hidden className={`size-4 transition-transform ${doneOpen ? "rotate-180" : ""}`} />
                  Concluídas <span className="num font-normal text-muted-foreground">{done.length}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul aria-label="Tarefas concluídas" className="mt-2 divide-y rounded-xl border bg-card">
                    {done.map((task) => (
                      <TaskRow key={task.id} task={task} />
                    ))}
                  </ul>
                </CollapsibleContent>
              </section>
            </Collapsible>
          )}
        </div>
      )}
    </>
  );
}

function NewTaskForm() {
  const save = useSaveTask();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ids = { input: useId(), error: useId() };

  return (
    <form
      aria-label="Nova tarefa"
      className="mb-6"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = taskTitleSchema.safeParse(title);
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Tarefa inválida.");
        save.mutate({ id: crypto.randomUUID(), title: parsed.data, done_at: null, created_at: new Date().toISOString() });
        setTitle("");
        setError(null);
        inputRef.current?.focus();
      }}
    >
      <label htmlFor={ids.input} className="sr-only">
        Nova tarefa
      </label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={ids.input}
          value={title}
          maxLength={500}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Nova tarefa…"
          className="h-11 text-base"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ids.error : undefined}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
        />
        <Button type="submit" className="size-11 shrink-0" aria-label="Adicionar tarefa">
          <Plus aria-hidden />
        </Button>
      </div>
      {error && (
        <p id={ids.error} role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

/** Linha da tarefa: concluir/reabrir e, se `deletable`, excluir (o painel Hoje só conclui). */
export function TaskRow({ task, deletable = true }: { task: Task; deletable?: boolean }) {
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const save = useSaveTask();
  const id = useId();
  const done = !!task.done_at;

  return (
    <li data-testid="task-row" className="flex items-center gap-1 pr-1">
      <label htmlFor={id} className="flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2 pl-4">
        <Checkbox
          id={id}
          className="size-5"
          checked={done}
          aria-label={done ? `Reabrir: ${task.title}` : `Concluir: ${task.title}`}
          onCheckedChange={(checked) => {
            const doneAt = checked === true ? new Date().toISOString() : null;
            toggle.mutate({ id: task.id, doneAt });
            if (doneAt) {
              toast.success("Tarefa concluída", {
                action: { label: "Desfazer", onClick: () => toggle.mutate({ id: task.id, doneAt: null }) },
              });
            }
          }}
        />
        <span className={`min-w-0 break-words ${done ? "text-muted-foreground line-through" : ""}`}>{task.title}</span>
      </label>
      {deletable && (
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Excluir: ${task.title}`}
          onClick={() => {
            remove.mutate(task.id);
            toast("Tarefa excluída", { action: { label: "Desfazer", onClick: () => save.mutate(task) } });
          }}
        >
          <Trash2 aria-hidden />
        </Button>
      )}
    </li>
  );
}
