import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { ProfileStoriesHub } from "@/features/profile/components/profile-stories-hub";

export const metadata: Metadata = { title: "Stories | Perfil" };

export default function ProfileStoriesPage() {
  return (
    <>
      <PageHeader title="Stories" eyebrow="Perfil" />
      <ProfileStoriesHub />
    </>
  );
}
