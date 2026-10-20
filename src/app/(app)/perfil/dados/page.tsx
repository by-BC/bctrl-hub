import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ProfileDataForm } from "@/features/profile/components/profile-form";

export const metadata: Metadata = { title: "Dados e metas" };

// Dados corporais e metas (atalho a partir de /perfil). Dados lidos no cliente
// (TanStack Query + RLS) e o dia calculado no navegador: o shell continua estático.
export default function PerfilDadosPage() {
  return (
    <>
      <PageHeader title="Dados e metas" eyebrow="Perfil" />
      <ProfileDataForm />
    </>
  );
}
