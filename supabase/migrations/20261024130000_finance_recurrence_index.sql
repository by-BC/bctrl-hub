create index if not exists finance_transactions_user_recurrence_idx
  on public.finance_transactions (user_id, recurrence_occurrence)
  where recurring_rule_id is not null;
