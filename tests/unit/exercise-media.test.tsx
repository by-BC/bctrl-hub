import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ExerciseMedia, ExerciseThumb } from "@/features/exercises/components/exercise-media";

const THUMB = "https://cdn.example.test/thumb.jpg";
const VIDEO = "https://cdn.example.test/video.mp4";

// O jsdom não reproduz mídia: `play()` vira uma promessa que nunca dispara "playing".
beforeAll(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
});

describe("ExerciseThumb", () => {
  it("mostra a miniatura com loading lazy", () => {
    render(<ExerciseThumb muscleGroup="Peito" thumbnailUrl={THUMB} />);
    const img = screen.getByTestId("exercise-thumb");
    expect(img).toHaveAttribute("src", THUMB);
    expect(img).toHaveAttribute("loading", "lazy");
    expect(screen.queryByTestId("media-placeholder")).toBeNull();
  });

  it("cai no placeholder em onError", () => {
    render(<ExerciseThumb muscleGroup="Peito" thumbnailUrl={THUMB} />);
    fireEvent.error(screen.getByTestId("exercise-thumb"));
    expect(screen.queryByTestId("exercise-thumb")).toBeNull();
    expect(screen.getByTestId("media-placeholder")).toHaveTextContent("Peito");
  });

  it("sem link: placeholder direto", () => {
    render(<ExerciseThumb muscleGroup={null} thumbnailUrl={null} />);
    expect(screen.getByTestId("media-placeholder")).toBeInTheDocument();
  });
});

describe("ExerciseMedia", () => {
  it("vídeo mudo, em loop, inline e sem pré-carga", () => {
    render(<ExerciseMedia name="Supino" muscleGroup="Peito" thumbnailUrl={THUMB} mediaUrl={VIDEO} />);
    const video = screen.getByTestId("exercise-video") as HTMLVideoElement;
    expect(video).toHaveAttribute("src", VIDEO);
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("preload", "none");
    // Antes de tocar, a miniatura fica por cima; há botão para reproduzir.
    expect(screen.getByTestId("exercise-image")).toHaveAttribute("src", THUMB);
    expect(screen.getByRole("button", { name: "Reproduzir demonstração" })).toBeInTheDocument();
  });

  it("vídeo e miniatura falhando: placeholder com o grupo muscular", () => {
    render(<ExerciseMedia name="Supino" muscleGroup="Peito" thumbnailUrl={THUMB} mediaUrl={VIDEO} />);
    fireEvent.error(screen.getByTestId("exercise-video"));
    expect(screen.queryByTestId("exercise-video")).toBeNull();
    expect(screen.queryByRole("button", { name: /demonstração/ })).toBeNull();
    fireEvent.error(screen.getByTestId("exercise-image"));
    expect(screen.getByTestId("media-placeholder")).toHaveTextContent("Peito");
  });

  it("sem mídia nenhuma: placeholder", () => {
    render(<ExerciseMedia name="Beach Tenis" muscleGroup="Cardio" thumbnailUrl={null} mediaUrl={null} />);
    expect(screen.getByTestId("media-placeholder")).toHaveTextContent("Cardio");
    expect(screen.getByRole("figure", { name: "Demonstração: Beach Tenis" })).toBeInTheDocument();
  });
});
