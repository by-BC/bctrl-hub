import type { Metadata } from "next";
import { Suspense } from "react";
import { DailyStoryScreen } from "@/features/story/DailyStoryScreen";

export const metadata: Metadata = { title: "Story do dia" };

export default function PerfilDailyStoryPage() {
  return (
    <Suspense fallback={<div className="space-y-4" aria-busy="true" aria-label="Carregando story do dia"><div className="h-10 w-48 animate-pulse rounded bg-muted" /><div className="aspect-[9/16] w-full max-w-[260px] animate-pulse rounded-xl bg-muted" /></div>}>
      <DailyStoryScreen />
    </Suspense>
  );
}
