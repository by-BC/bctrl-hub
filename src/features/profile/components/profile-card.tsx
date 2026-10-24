"use client";

import { ChevronRight, UserRound } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useBodyWeights } from "@/features/progress/hooks";
import { isCompleteProfile, type Goal } from "@/features/nutrition/domain/nutrition";
import { formatKg } from "@/lib/format";
import { useProfile } from "../hooks";

const GOAL_LABEL: Record<Goal, string> = { lose: "Perder gordura", maintain: "Manter", gain: "Ganhar massa" };

/** Dados corporais e objetivo (RF09), com o atalho para editar os dados e as metas. */
export function ProfileCard() {
  const profile = useProfile();
  const weights = useBodyWeights();
  const p = profile.data;
  const lastWeight = weights.data?.at(-1)?.weight_kg ?? null;

  return (
    <Link
      href="/perfil/dados"
      className="group flex min-h-16 items-center gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <UserRound className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Dados e metas</span>
        {profile.isPending ? (
          <Skeleton className="mt-1 h-4 w-48" />
        ) : isCompleteProfile(p) ? (
          <span className="block text-sm text-muted-foreground">
            {GOAL_LABEL[p.goal]} · <span className="num">{formatKg(p.height_cm)} cm</span>
            {lastWeight !== null && (
              <>
                {" "}
                · <span className="num">{formatKg(lastWeight)} kg</span>
              </>
            )}
          </span>
        ) : (
          <span className="block text-sm text-muted-foreground">Defina seus dados para ver metas</span>
        )}
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
