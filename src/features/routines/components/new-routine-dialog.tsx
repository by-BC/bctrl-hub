"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nextPosition } from "@/lib/domain/routines";
import { firstError, REST_DEFAULT, routineFormSchema } from "@/lib/schemas/routine";
import type { RoutineListItem } from "../api";
import { useCreateRoutine } from "../hooks";

/** Cria a rotina no fim da sequência e abre o editor. */
export function NewRoutineDialog({ routines, className }: { routines: RoutineListItem[]; className?: string }) {
  const router = useRouter();
  const ids = { name: useId(), error: useId() };
  const create = useCreateRoutine();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = routineFormSchema.safeParse({
      name: String(new FormData(event.currentTarget).get("name") ?? ""),
      rest_sec: REST_DEFAULT,
    });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    const id = crypto.randomUUID();
    const active = routines.filter((r) => !r.archived_at);
    // Otimista: o editor abre na hora, com a rotina já no cache.
    create.mutate({ id, name: parsed.data.name, position: nextPosition(active) });
    setOpen(false);
    router.push(`/treino/rotinas/${id}`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button className={className ?? "h-11 font-semibold"}>
          <Plus aria-hidden />
          Nova rotina
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Nova rotina</DialogTitle>
            <DialogDescription>Ela entra no fim da sequência. Depois é só adicionar os exercícios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={ids.name}>Nome da rotina</Label>
            <Input
              id={ids.name}
              name="name"
              placeholder="Ex.: Upper 3"
              autoComplete="off"
              maxLength={120}
              className="h-11 text-base"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? ids.error : undefined}
            />
            <p id={ids.error} role="alert" className="min-h-5 text-sm text-destructive">
              {error}
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" className="h-11 font-semibold">
              Criar rotina
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
