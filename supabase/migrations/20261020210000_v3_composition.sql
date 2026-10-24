-- Bctrl Hub v3: composição corporal (medições da balança, metas de composição, fonte da TMB).
-- Não altera migrations já aplicadas: só acrescenta. `month_summary` fica em `…_v3_rpcs.sql`.

-- ── body_measurements: uma linha por medição da balança ───────────────────
-- Só o peso é obrigatório. As faixas espelham `METRICS` em src/features/composition/domain/composition.ts
-- (mudou uma, mude a outra). `day` vem do cliente, mas precisa ser o dia de São Paulo do instante.
-- Idempotência da importação: `unique (user_id, measured_at)`.

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_at timestamptz not null,
  day date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 300),
  bmi numeric(6, 2) check (bmi between 10 and 70),
  body_fat_pct numeric(6, 2) check (body_fat_pct between 2 and 70),
  fat_mass_kg numeric(6, 2) check (fat_mass_kg between 0.5 and 200),
  skeletal_muscle_pct numeric(6, 2) check (skeletal_muscle_pct between 10 and 75),
  skeletal_muscle_kg numeric(6, 2) check (skeletal_muscle_kg between 5 and 120),
  muscle_rate_pct numeric(6, 2) check (muscle_rate_pct between 20 and 98),
  muscle_mass_kg numeric(6, 2) check (muscle_mass_kg between 10 and 200),
  visceral_fat numeric(6, 2) check (visceral_fat between 1 and 60),
  water_pct numeric(6, 2) check (water_pct between 20 and 80),
  water_kg numeric(6, 2) check (water_kg between 10 and 150),
  bmr_kcal numeric(6, 1) check (bmr_kcal between 500 and 5000),
  obesity_pct numeric(6, 2) check (obesity_pct between -60 and 300),
  bone_kg numeric(6, 2) check (bone_kg between 0.5 and 10),
  protein_pct numeric(6, 2) check (protein_pct between 5 and 40),
  lean_mass_kg numeric(6, 2) check (lean_mass_kg between 15 and 200),
  metabolic_age int check (metabolic_age between 10 and 100),
  source text not null default 'manual' check (source in ('import', 'manual')),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, measured_at),
  constraint body_measurements_day_check check (day = (measured_at at time zone 'America/Sao_Paulo')::date)
);

create index body_measurements_user_day_idx on public.body_measurements (user_id, day);

-- ── body_weights: origem do peso do dia ───────────────────────────────────
-- `scale`: gravado pelo trigger a partir da medição; `manual`: digitado (o upsert do app envia).

alter table public.body_weights
  add column source text not null default 'manual' check (source in ('manual', 'scale'));

-- ── composition_goals: metas de composição ────────────────────────────────
-- No máximo uma meta ativa (não arquivada) por métrica.

create table public.composition_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  metric text not null check (metric in ('weight_kg', 'body_fat_pct', 'skeletal_muscle_kg', 'visceral_fat')),
  target numeric(6, 2) not null,
  target_date date,
  start_value numeric(6, 2) not null,
  start_day date not null,
  achieved_on date,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index composition_goals_active_idx on public.composition_goals (user_id, metric) where archived_at is null;
create index composition_goals_user_id_idx on public.composition_goals (user_id);

-- ── profiles: fonte da TMB e base da proteína ─────────────────────────────
-- `bmr_source`: auto (balança se a medição tem ≤ 30 dias), scale ou formula (ver nutrition.ts).

alter table public.profiles
  add column bmr_source text not null default 'auto' check (bmr_source in ('auto', 'scale', 'formula')),
  add column protein_basis text not null default 'weight' check (protein_basis in ('weight', 'lean_mass')),
  add column protein_g_per_kg_lean numeric(3, 1) not null default 2.5 check (protein_g_per_kg_lean between 0.5 and 5);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Mesmo padrão da v1/v2: só `authenticated`, `(select auth.uid())` avaliado uma vez.

revoke all on table public.body_measurements, public.composition_goals from anon, public;
grant select, insert, update, delete on table public.body_measurements, public.composition_goals to authenticated;
grant all on table public.body_measurements, public.composition_goals to service_role;

alter table public.body_measurements enable row level security;
alter table public.composition_goals enable row level security;

create policy "dono acessa as próprias medições" on public.body_measurements
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "dono acessa as próprias metas de composição" on public.composition_goals
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── Trigger: peso do dia a partir da medição ──────────────────────────────
-- Para cada dia afetado: se ainda há medição no dia, grava em `body_weights` o peso da de maior
-- `measured_at` com `source = 'scale'` (sobrescreve inclusive um peso manual: a última gravação
-- vence). Se não há mais medição, apaga o peso do dia só se ele for `scale`; o manual fica.
-- Update só dispara quando muda o que decide o peso do dia (editar a nota não mexe no manual).
-- `security invoker`: roda com o RLS de quem grava.
-- Exclusão do usuário: a cascata de `auth.users` roda como `supabase_auth_admin`, que não tem
-- acesso às tabelas do app, e os triggers AFTER da cascata disparam no nível 1 (o
-- pg_trigger_depth() não distingue). Quem apaga sem poder ler as medições não é o app: não há
-- peso a recalcular, porque `body_weights` também some por cascata.

create function public.sync_body_weight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_days date[];
  v_user uuid;
  v_day date;
  v_weight numeric;
begin
  if tg_op = 'DELETE' and not has_table_privilege('public.body_measurements', 'select') then
    return null;
  end if;

  if tg_op = 'INSERT' then
    v_user := new.user_id;
    v_days := array[new.day];
  elsif tg_op = 'DELETE' then
    v_user := old.user_id;
    v_days := array[old.day];
  else
    -- O RLS não deixa trocar o dono; o dia pode mudar.
    v_user := new.user_id;
    v_days := array[old.day, new.day];
  end if;

  foreach v_day in array v_days loop
    select m.weight_kg into v_weight
    from public.body_measurements m
    where m.user_id = v_user and m.day = v_day
    order by m.measured_at desc
    limit 1;

    if found then
      insert into public.body_weights (user_id, day, weight_kg, source)
      values (v_user, v_day, v_weight, 'scale')
      on conflict (user_id, day) do update
        set weight_kg = excluded.weight_kg, source = 'scale';
    else
      delete from public.body_weights w
      where w.user_id = v_user and w.day = v_day and w.source = 'scale';
    end if;
  end loop;

  return null;
end
$$;

revoke all on function public.sync_body_weight() from public, anon, authenticated;

create trigger body_measurements_sync_weight
after insert or delete or update of weight_kg, measured_at, day, user_id on public.body_measurements
for each row execute function public.sync_body_weight();
