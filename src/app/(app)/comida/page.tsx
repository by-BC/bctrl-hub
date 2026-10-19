import type { Metadata } from "next";
import { MealDay } from "@/features/meals/components/meal-day";

export const metadata: Metadata = { title: "Comida" };

// Dados lidos no cliente (TanStack Query + RLS) e o dia calculado no navegador
// (America/Sao_Paulo): o shell continua estático.
export default function ComidaPage() {
  return <MealDay />;
}
