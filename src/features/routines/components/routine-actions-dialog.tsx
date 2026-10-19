"use client";

import { Archive, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import type { RoutineDetail } from "../api";
import { useDeleteRoutine, useRoutineWorkoutCount, useSetRoutineArchived } from "../hooks";

/**
 * Arquivar tira a rotina da sequência e mantém o histórico.
 * Excluir só aparece quando não há nenhum treino registrado com ela.
 */
export function RoutineActionsDialog({ routine }: { routine: RoutineDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const workouts = useRoutineWorkoutCount(routine.id, open);
  const setArchived = useSetRoutineArchived();
  const remove = useDeleteRoutine();

  const count = workouts.data;
  const canDelete = count === 0;

  function archive() {
    setArchived.mutate({ id: routine.id, archived: true });
    setOpen(false);
    router.push("/treino");
  }

  function destroy() {
    remove.mutate(routine.id);
    setOpen(false);
    router.push("/treino");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 w-full sm:w-auto">
          <Archive aria-hidden />
          Arquivar ou excluir rotina
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle>Tirar “{routine.name}” da sequência?</DialogTitle>
          <DialogDescription>
            {workouts.isPending
              ? "Verificando o histórico da rotina…"
              : workouts.isError
                ? "Não foi possível verificar o histórico. Por segurança, só é possível arquivar."
                : canDelete
                  ? "Nenhum treino foi registrado com ela. Você pode arquivar (dá para restaurar depois) ou excluir de vez."
                  : `Ela já tem ${count} ${count === 1 ? "treino registrado" : "treinos registrados"}. Arquivar mantém esse histórico e dá para restaurar depois.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          {canDelete && (
            <Button variant="destructive" className="h-11" onClick={destroy}>
              <Trash2 aria-hidden />
              Excluir rotina
            </Button>
          )}
          <Button className="h-11 font-semibold" onClick={archive} disabled={workouts.isPending}>
            <Archive aria-hidden />
            Arquivar rotina
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
