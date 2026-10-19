import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { StoryPoc } from "./story-poc";

export const metadata: Metadata = { title: "POC story" };

// Prova de conceito (task 1.10): validar html-to-image + fontes no iPhone
// antes de construir o Story Studio (task 9.0).
export default function StoryPocPage() {
  return (
    <>
      <PageHeader title="POC do story" eyebrow="Dev" />
      <StoryPoc />
    </>
  );
}
