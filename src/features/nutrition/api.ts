import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Food } from "@/lib/domain/nutrition";
import { createClient } from "@/lib/supabase/client";
import { DataError } from "@/features/routines/api";

/**
 * Alimentos (`foods`): a TACO (user_id nulo, leitura de todo usuário logado) e os próprios.
 * São ~600 linhas pequenas: o app carrega tudo uma vez e busca em memória, sem acento
 * (`searchFoods`), o que dispensa `unaccent` no banco.
 */

type Client = SupabaseClient<Database>;

export const foodKeys = {
  all: ["foods"] as const,
};

/** Fonte citada no rodapé da busca. */
export const TACO_CREDIT = "TACO 4ª ed. — NEPA/Unicamp";

const PAGE = 1000; // max_rows do PostgREST

export async function fetchFoods(client: Client = createClient()): Promise<Food[]> {
  const out: Food[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("foods")
      .select("id, name, category, taco_id, kcal, protein_g, carbs_g, fat_g, unit_grams")
      .order("name")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error("[bctrl]", "Não foi possível carregar os alimentos.", error);
      throw new DataError("Não foi possível carregar os alimentos.", error.code);
    }
    out.push(
      ...data.map((f) => ({
        ...f,
        unit_grams: f.unit_grams && typeof f.unit_grams === "object" && !Array.isArray(f.unit_grams)
          ? (f.unit_grams as Record<string, number>)
          : null,
      })),
    );
    if (data.length < PAGE) return out;
  }
}
