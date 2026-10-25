import { z } from "zod";

export const financeKinds = ["income", "expense"] as const;
export const financeBuckets = ["fixed", "freedom", "variable"] as const;
export const financeSubBuckets = ["comfort", "pleasures", "knowledge", "goals"] as const;
export const financeAccountKinds = ["cash", "checking", "savings", "credit_card"] as const;

export const financeTitleSchema = z.string().trim().min(1, "Informe uma descrição.").max(140, "Use até 140 caracteres.");

export const financeAmountSchema = z.number().finite().positive("O valor precisa ser maior que zero.").max(9999999999.99);

export const financeBudgetSchema = z.object({
  month_start: z.string().regex(/^\d{4}-\d{2}-01$/),
  planned_income: z.number().finite().min(0).max(9999999999.99),
  fixed_pct: z.number().min(0).max(1),
  freedom_pct: z.number().min(0).max(1),
  variable_pct: z.number().min(0).max(1),
  comfort_pct: z.number().min(0).max(1),
  pleasures_pct: z.number().min(0).max(1),
  knowledge_pct: z.number().min(0).max(1),
  goals_pct: z.number().min(0).max(1),
}).refine((v) => Math.abs(v.fixed_pct + v.freedom_pct + v.variable_pct - 1) < 0.00001, {
  message: "As três caixas precisam somar 100%.",
  path: ["fixed_pct"],
}).refine((v) => Math.abs(v.comfort_pct + v.pleasures_pct + v.knowledge_pct + v.goals_pct - 1) < 0.00001, {
  message: "A divisão dos gastos eventuais precisa somar 100%.",
  path: ["comfort_pct"],
});

export const financeAccountSchema = z.object({
  name: financeTitleSchema.max(80),
  kind: z.enum(financeAccountKinds),
  closing_day: z.number().int().min(1).max(31).nullable(),
  due_day: z.number().int().min(1).max(31).nullable(),
}).refine((v) => v.kind !== "credit_card" || (v.closing_day !== null && v.due_day !== null), {
  message: "Informe o fechamento e o vencimento do cartão.",
  path: ["closing_day"],
}).refine((v) => v.kind === "credit_card" || (v.closing_day === null && v.due_day === null), {
  message: "Fechamento e vencimento só se aplicam a cartões.",
  path: ["kind"],
});

export const financeRecurringSchema = z.object({
  title: financeTitleSchema,
  kind: z.enum(financeKinds),
  category_id: z.string().uuid(),
  account_id: z.string().uuid().nullable(),
  amount: financeAmountSchema,
  day_of_month: z.number().int().min(1).max(31),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).refine((v) => !v.ends_on || v.ends_on >= v.starts_on, {
  message: "A data final precisa ser igual ou posterior à inicial.",
  path: ["ends_on"],
});

export const financeTransactionSchema = z.object({
  kind: z.enum(financeKinds),
  category_id: z.string().uuid(),
  account_id: z.string().uuid().nullable(),
  title: financeTitleSchema,
  amount: financeAmountSchema,
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_paid: z.boolean(),
  installment_count: z.number().int().min(1).max(60),
  notes: z.string().trim().max(500).nullable(),
});

export type FinanceBudgetSave = z.infer<typeof financeBudgetSchema>;
export type FinanceAccountSave = z.infer<typeof financeAccountSchema>;
export type FinanceRecurringSave = z.infer<typeof financeRecurringSchema>;
export type FinanceTransactionSave = z.infer<typeof financeTransactionSchema>;
