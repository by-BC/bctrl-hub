import type { Metadata } from "next";
import { MealPlanEditor } from "@/features/meals/components/meal-plan-editor";

export const metadata: Metadata = { title: "Plano alimentar" };

// Dados lidos no cliente (TanStack Query + RLS): o shell continua estático.
export default function ComidaPlanoPage() {
  return <MealPlanEditor />;
}
