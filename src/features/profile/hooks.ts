"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { WRITES } from "@/lib/query/mutation-defaults";
import { fetchProfile, profileKeys, type Profile, type ProfileSave } from "./api";

export function useProfile() {
  return useQuery({ queryKey: profileKeys.me(), queryFn: () => fetchProfile() });
}

/** Salvar o perfil: otimista (as metas mudam na hora), desfaz no erro e revalida no fim. */
export function useSaveProfile() {
  const qc = useQueryClient();
  const key = profileKeys.me();
  return useMutation({
    ...WRITES.saveProfile,
    scope: { id: "profile" },
    onMutate: async (row: ProfileSave) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Profile | null>(key);
      qc.setQueryData<Profile | null>(key, row);
      return { previous };
    },
    onError: (error, _row, ctx) => {
      if (ctx && ctx.previous !== undefined) qc.setQueryData(key, ctx.previous);
      toast.error(error instanceof DataError ? error.message : "Algo deu errado. Tente de novo.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
