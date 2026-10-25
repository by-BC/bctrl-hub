alter table public.finance_categories alter column user_id set default auth.uid();
create index if not exists finance_transactions_user_recurrence_idx on public.finance_transactions (user_id, recurrence_occurrence)
  where recurring_rule_id is not null;

alter table public.finance_accounts drop constraint finance_accounts_check;
alter table public.finance_accounts add constraint finance_accounts_card_days_check check (
  (kind = 'credit_card' and closing_day is not null and closing_day between 1 and 31 and due_day is not null and due_day between 1 and 31)
  or (kind <> 'credit_card' and closing_day is null and due_day is null)
);

alter table public.finance_transactions drop constraint finance_transactions_check;
alter table public.finance_transactions add constraint finance_transactions_installments_check check (
  (installment_group_id is null and installment_number is null and installment_count is null)
  or (installment_group_id is not null and installment_number is not null and installment_count is not null
    and installment_number between 1 and installment_count and installment_count between 2 and 60)
);
