create function public.validate_finance_recurring_rule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_category_user uuid;
  v_category_kind text;
begin
  select c.user_id, c.kind into v_category_user, v_category_kind
  from public.finance_categories c where c.id = new.category_id;
  if not found or (v_category_user is not null and v_category_user <> new.user_id) or v_category_kind <> new.kind then
    raise exception 'Categoria financeira inválida.' using errcode = '23514';
  end if;

  if new.account_id is not null and not exists (
    select 1 from public.finance_accounts a where a.id = new.account_id and a.user_id = new.user_id
  ) then
    raise exception 'Conta financeira inválida.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.validate_finance_recurring_rule() from public, anon, authenticated;
create trigger finance_recurring_rules_validate
before insert or update on public.finance_recurring_rules
for each row execute function public.validate_finance_recurring_rule();
