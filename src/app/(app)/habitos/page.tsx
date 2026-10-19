import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Hábitos" };

export default function HabitosPage() {
  return (
    <>
      <PageHeader title="Hábitos" eyebrow="Semana" />
      <ComingSoon task="7.0">Cardio, abdominal, suplementos e hábitos personalizados.</ComingSoon>
    </>
  );
}
