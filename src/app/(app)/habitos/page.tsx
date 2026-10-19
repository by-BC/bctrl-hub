import type { Metadata } from "next";
import { HabitWeek } from "@/features/habits/components/habit-week";

export const metadata: Metadata = { title: "Hábitos" };

// Dados lidos no cliente (TanStack Query + RLS) e a semana calculada no navegador
// (America/Sao_Paulo): o shell continua estático.
export default function HabitosPage() {
  return <HabitWeek />;
}
