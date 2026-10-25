"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataError } from "@/features/routines/api";
import { WRITES } from "@/lib/query/mutation-defaults";
import { fetchFinanceMonth, financeKeys } from "./api";

export function useFinanceMonth(month: string) {
  return useQuery({ queryKey: financeKeys.month(month), queryFn: () => fetchFinanceMonth(month), enabled: !!month });
}

function useFinanceWrite<TData, TVariables>(write: {
  mutationKey: readonly [string, string];
  mutationFn: (variables: TVariables) => Promise<TData>;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    ...write,
    scope: { id: "finance" },
    onError: (error) => toast.error(error instanceof DataError ? error.message : "Não foi possível salvar. Tente novamente."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export const useSaveFinanceTransactions = () => useFinanceWrite(WRITES.saveFinanceTransactions);
export const useSaveFinanceBudget = () => useFinanceWrite(WRITES.saveFinanceBudget);
export const useSaveFinanceAccount = () => useFinanceWrite(WRITES.saveFinanceAccount);
export const useSaveFinanceRecurring = () => useFinanceWrite(WRITES.saveFinanceRecurring);
export const useSetFinanceRecurring = () => useFinanceWrite(WRITES.setFinanceRecurring);
export const useCreateFinanceCategory = () => useFinanceWrite(WRITES.createFinanceCategory);
export const useSetFinancePaid = () => useFinanceWrite(WRITES.setFinancePaid);
export const useUpdateFinanceTransaction = () => useFinanceWrite(WRITES.updateFinanceTransaction);
export const useSetFinanceInvoicePaid = () => useFinanceWrite(WRITES.setFinanceInvoicePaid);
export const useDeleteFinanceTransaction = () => useFinanceWrite(WRITES.deleteFinanceTransaction);
