-- Controle financeiro pessoal: categorias, contas, orçamento, lançamentos e recorrências.
-- Dados do usuário nunca são compartilhados entre contas; cartões guardam somente apelido e datas.

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('income', 'expense')),
  bucket text check (bucket in ('fixed', 'freedom', 'variable')),
  sub_bucket text check (sub_bucket in ('comfort', 'pleasures', 'knowledge', 'goals')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  check ((kind = 'income' and bucket is null and sub_bucket is null) or (kind = 'expense' and bucket is not null)),
  check (bucket = 'variable' or sub_bucket is null),
  check ((user_id is null) = is_default),
  unique (id, user_id)
);

create unique index finance_categories_name_kind_idx
  on public.finance_categories (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name), kind);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('cash', 'checking', 'savings', 'credit_card')),
  closing_day smallint,
  due_day smallint,
  created_at timestamptz not null default now(),
  check (
    (kind = 'credit_card' and closing_day is not null and closing_day between 1 and 31 and due_day is not null and due_day between 1 and 31)
    or (kind <> 'credit_card' and closing_day is null and due_day is null)
  ),
  unique (id, user_id)
);

create table public.finance_monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month_start date not null check (month_start = date_trunc('month', month_start)::date),
  planned_income numeric(12, 2) not null default 0 check (planned_income >= 0),
  fixed_pct numeric(5, 4) not null default 0.5 check (fixed_pct between 0 and 1),
  freedom_pct numeric(5, 4) not null default 0.2 check (freedom_pct between 0 and 1),
  variable_pct numeric(5, 4) not null default 0.3 check (variable_pct between 0 and 1),
  comfort_pct numeric(5, 4) not null default 0.5 check (comfort_pct between 0 and 1),
  pleasures_pct numeric(5, 4) not null default 0.2 check (pleasures_pct between 0 and 1),
  knowledge_pct numeric(5, 4) not null default 0.15 check (knowledge_pct between 0 and 1),
  goals_pct numeric(5, 4) not null default 0.15 check (goals_pct between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fixed_pct + freedom_pct + variable_pct = 1),
  check (comfort_pct + pleasures_pct + knowledge_pct + goals_pct = 1),
  unique (user_id, month_start)
);

create table public.finance_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 140),
  kind text not null check (kind in ('income', 'expense')),
  category_id uuid not null references public.finance_categories (id) on delete restrict,
  account_id uuid references public.finance_accounts (id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  category_id uuid not null references public.finance_categories (id) on delete restrict,
  account_id uuid references public.finance_accounts (id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 140),
  amount numeric(12, 2) not null check (amount > 0),
  occurred_on date not null,
  due_on date not null,
  is_paid boolean not null default true,
  notes text check (length(notes) <= 500),
  installment_group_id uuid,
  installment_number smallint,
  installment_count smallint,
  recurring_rule_id uuid,
  recurrence_occurrence date,
  created_at timestamptz not null default now(),
  check (
    (installment_group_id is null and installment_number is null and installment_count is null)
    or (installment_group_id is not null and installment_number is not null and installment_count is not null
      and installment_number between 1 and installment_count and installment_count between 2 and 60)
  ),
  check ((recurring_rule_id is null) = (recurrence_occurrence is null)),
  unique (user_id, installment_group_id, installment_number),
  unique (user_id, recurring_rule_id, recurrence_occurrence),
  foreign key (recurring_rule_id, user_id) references public.finance_recurring_rules (id, user_id) on delete restrict
);

create index finance_transactions_user_due_idx on public.finance_transactions (user_id, due_on desc, created_at desc);
create index finance_transactions_user_category_idx on public.finance_transactions (user_id, category_id, due_on);
create index finance_transactions_user_account_idx on public.finance_transactions (user_id, account_id, due_on);
create index finance_transactions_user_recurrence_idx on public.finance_transactions (user_id, recurrence_occurrence)
  where recurring_rule_id is not null;
create index finance_recurring_user_active_idx on public.finance_recurring_rules (user_id, active, day_of_month);

-- Categorias padrão da planilha: são somente leitura e ficam disponíveis para usuários autenticados.
insert into public.finance_categories (user_id, name, kind, bucket, sub_bucket, is_default) values
  (null, 'Moradia (aluguel/financiamento)', 'expense', 'fixed', null, true),
  (null, 'Condomínio', 'expense', 'fixed', null, true),
  (null, 'Contas da casa', 'expense', 'fixed', null, true),
  (null, 'Internet e celular', 'expense', 'fixed', null, true),
  (null, 'Supermercado', 'expense', 'fixed', null, true),
  (null, 'Transporte', 'expense', 'fixed', null, true),
  (null, 'Parcela do carro', 'expense', 'fixed', null, true),
  (null, 'Saúde', 'expense', 'fixed', null, true),
  (null, 'Educação', 'expense', 'fixed', null, true),
  (null, 'Seguros', 'expense', 'fixed', null, true),
  (null, 'Impostos e taxas', 'expense', 'fixed', null, true),
  (null, 'Filhos e dependentes', 'expense', 'fixed', null, true),
  (null, 'Roupa do dia a dia', 'expense', 'fixed', null, true),
  (null, 'Parcela mínima de dívidas', 'expense', 'fixed', null, true),
  (null, 'Reserva de emergência', 'expense', 'freedom', null, true),
  (null, 'Investimentos', 'expense', 'freedom', null, true),
  (null, 'Previdência / aposentadoria', 'expense', 'freedom', null, true),
  (null, 'Amortização extra de dívidas', 'expense', 'freedom', null, true),
  (null, 'Diarista e serviços', 'expense', 'variable', 'comfort', true),
  (null, 'Streaming e assinaturas', 'expense', 'variable', 'comfort', true),
  (null, 'Compras e vestuário', 'expense', 'variable', 'comfort', true),
  (null, 'Mercado especial e conveniência', 'expense', 'variable', 'comfort', true),
  (null, 'Casa e decoração', 'expense', 'variable', 'comfort', true),
  (null, 'Beleza e cuidados pessoais', 'expense', 'variable', 'comfort', true),
  (null, 'Academia', 'expense', 'variable', 'comfort', true),
  (null, 'Pets', 'expense', 'variable', 'comfort', true),
  (null, 'Outros eventuais', 'expense', 'variable', 'comfort', true),
  (null, 'Restaurantes e delivery', 'expense', 'variable', 'pleasures', true),
  (null, 'Lazer e entretenimento', 'expense', 'variable', 'pleasures', true),
  (null, 'Presentes e doações', 'expense', 'variable', 'pleasures', true),
  (null, 'Cursos e livros', 'expense', 'variable', 'knowledge', true),
  (null, 'Aulas e hobbies', 'expense', 'variable', 'knowledge', true),
  (null, 'Viagens', 'expense', 'variable', 'goals', true),
  (null, 'Metas e sonhos', 'expense', 'variable', 'goals', true),
  (null, 'Salário', 'income', null, null, true),
  (null, 'Renda extra', 'income', null, null, true);

-- Trigger valida propriedade da categoria/conta/regra e coerência de tipo pelo banco.
create function public.validate_finance_transaction()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_category_user uuid;
  v_category_kind text;
  v_account_kind text;
  v_rule_kind text;
begin
  select c.user_id, c.kind into v_category_user, v_category_kind
  from public.finance_categories c where c.id = new.category_id;
  if not found or (v_category_user is not null and v_category_user <> new.user_id) or v_category_kind <> new.kind then
    raise exception 'Categoria financeira inválida.' using errcode = '23514';
  end if;

  if new.account_id is not null then
    select a.kind into v_account_kind from public.finance_accounts a
    where a.id = new.account_id and a.user_id = new.user_id;
    if not found then raise exception 'Conta financeira inválida.' using errcode = '23514'; end if;
    if new.installment_count is not null and v_account_kind <> 'credit_card' then
      raise exception 'Parcelas exigem uma conta de cartão.' using errcode = '23514';
    end if;
  elsif new.installment_count is not null then
    raise exception 'Parcelas exigem uma conta de cartão.' using errcode = '23514';
  end if;

  if new.recurring_rule_id is not null then
    select r.kind into v_rule_kind from public.finance_recurring_rules r
    where r.id = new.recurring_rule_id and r.user_id = new.user_id;
    if not found or v_rule_kind <> new.kind then
      raise exception 'Regra recorrente inválida.' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.validate_finance_transaction() from public, anon, authenticated;
create trigger finance_transactions_validate
before insert or update on public.finance_transactions
for each row execute function public.validate_finance_transaction();

revoke all on table public.finance_categories, public.finance_accounts, public.finance_monthly_budgets,
  public.finance_recurring_rules, public.finance_transactions from anon, public;
grant select, insert, update, delete on table public.finance_categories, public.finance_accounts,
  public.finance_monthly_budgets, public.finance_recurring_rules, public.finance_transactions to authenticated;
grant all on table public.finance_categories, public.finance_accounts, public.finance_monthly_budgets,
  public.finance_recurring_rules, public.finance_transactions to service_role;

alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_monthly_budgets enable row level security;
alter table public.finance_recurring_rules enable row level security;
alter table public.finance_transactions enable row level security;

create policy "lê categorias padrão e próprias" on public.finance_categories
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "cria categorias próprias" on public.finance_categories
  for insert to authenticated with check (user_id = (select auth.uid()) and not is_default);
create policy "altera categorias próprias" on public.finance_categories
  for update to authenticated using (user_id = (select auth.uid()) and not is_default)
  with check (user_id = (select auth.uid()) and not is_default);
create policy "apaga categorias próprias" on public.finance_categories
  for delete to authenticated using (user_id = (select auth.uid()) and not is_default);

create policy "dono acessa as próprias contas financeiras" on public.finance_accounts
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono acessa o próprio orçamento financeiro" on public.finance_monthly_budgets
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono acessa as próprias recorrências" on public.finance_recurring_rules
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono acessa os próprios lançamentos financeiros" on public.finance_transactions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
