-- Bctrl Hub v2: esquema (tipos de exercício e de série, perfil e nutrição).
-- Não altera migrations já aplicadas: só acrescenta. Views e `finish_workout` ficam em
-- `…_v2_rpcs.sql`.

-- ── exercises: catálogo do Hevy ───────────────────────────────────────────
-- `exercise_type` define os campos da série (ver src/lib/domain/exercise-types.ts).
-- `hevy_template_id`: único por usuário (nulo nos exercícios criados no app).
-- Mídia por link (sem cópia): só endereços https.

alter table public.exercises
  add column hevy_template_id text check (length(btrim(hevy_template_id)) between 1 and 64),
  add column exercise_type text not null default 'weight_reps' check (
    exercise_type in (
      'weight_reps', 'reps_only', 'bodyweight_reps', 'bodyweight_assisted_reps',
      'duration', 'weight_duration', 'distance_duration', 'short_distance_weight'
    )
  ),
  add column equipment text check (length(equipment) <= 60),
  add column secondary_muscles text[] not null default '{}',
  add column thumbnail_url text check (thumbnail_url ~ '^https://' and length(thumbnail_url) <= 1000),
  add column media_url text check (media_url ~ '^https://' and length(media_url) <= 1000),
  add column instructions text check (length(instructions) <= 2000),
  add column source text not null default 'bctrl' check (source in ('bctrl', 'hevy', 'hevy_custom')),
  add constraint exercises_user_id_hevy_template_id_key unique (user_id, hevy_template_id);

-- ── workouts: origem e idempotência da importação ─────────────────────────

alter table public.workouts
  add column hevy_workout_id text check (length(btrim(hevy_workout_id)) between 1 and 64),
  add column source text not null default 'bctrl' check (source in ('bctrl', 'hevy')),
  add constraint workouts_user_id_hevy_workout_id_key unique (user_id, hevy_workout_id);

-- ── workout_sets: tipos de série ──────────────────────────────────────────
-- Carga e reps deixam de ser obrigatórias (prancha, corrida…), mas toda série tem ao
-- menos uma métrica. Aquecimento (`warmup`) não conta para recordes nem volume.

alter table public.workout_sets
  alter column weight_kg drop not null,
  alter column reps drop not null,
  add column distance_m numeric(8, 1) check (distance_m >= 0),
  add column duration_s int check (duration_s >= 0),
  add column set_type text not null default 'normal' check (set_type in ('normal', 'warmup', 'failure', 'dropset')),
  add constraint workout_sets_has_metric check (num_nonnulls(weight_kg, reps, distance_m, duration_s) >= 1),
  drop constraint workout_sets_pr_kinds_check,
  add constraint workout_sets_pr_kinds_check
    check (pr_kinds <@ array['weight', 'volume', 'e1rm', 'duration', 'distance']);

-- ── profiles: 1 linha por usuário ─────────────────────────────────────────
-- Dados de saúde: só o dono acessa. Metas são calculadas no cliente (nutrition.ts);
-- `goal_overrides` guarda o ajuste manual: { "rest"?: Macros, "training"?: Macros }.

create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (length(btrim(display_name)) between 1 and 80),
  sex text check (sex in ('m', 'f')),
  birth_date date check (birth_date >= '1900-01-01'),
  height_cm numeric(4, 1) check (height_cm between 50 and 260),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text check (goal in ('lose', 'maintain', 'gain')),
  protein_g_per_kg numeric(3, 1) not null default 2.0 check (protein_g_per_kg between 0.5 and 4),
  goal_overrides jsonb not null default '{}' check (jsonb_typeof(goal_overrides) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── foods: TACO (user_id nulo) e alimentos próprios ───────────────────────
-- Valores por 100 g. `unit_grams`: peso de referência por unidade, ex.: {"un": 50}.
-- A TACO é carregada por migration (sem auth.uid(), então user_id fica nulo).

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  taco_id int unique,
  name text not null check (length(btrim(name)) between 1 and 200),
  category text check (length(category) <= 120),
  kcal numeric(7, 2) not null check (kcal >= 0),
  protein_g numeric(6, 2) not null check (protein_g >= 0),
  carbs_g numeric(6, 2) not null check (carbs_g >= 0),
  fat_g numeric(6, 2) not null check (fat_g >= 0),
  unit_grams jsonb not null default '{}' check (jsonb_typeof(unit_grams) = 'object'),
  created_at timestamptz not null default now(),
  -- Só a TACO tem taco_id.
  check (taco_id is null or user_id is null)
);

-- ── meal_log_items: o que foi comido fora do plano ────────────────────────
-- Snapshot de nome e macros no momento do registro: editar o alimento depois não
-- reescreve dias passados (e o item sobrevive se o alimento for apagado).

alter table public.meal_logs add constraint meal_logs_id_user_id_key unique (id, user_id);

create table public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_log_id uuid not null,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 200),
  grams numeric(7, 1) not null check (grams > 0),
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carbs_g numeric(6, 1) not null check (carbs_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  foreign key (meal_log_id, user_id) references public.meal_logs (id, user_id) on delete cascade
);

-- ── Índices ───────────────────────────────────────────────────────────────

create index foods_user_id_idx on public.foods (user_id);
create index meal_log_items_meal_log_idx on public.meal_log_items (meal_log_id, user_id);
create index meal_log_items_user_id_idx on public.meal_log_items (user_id);
create index meal_log_items_food_id_idx on public.meal_log_items (food_id);
-- exercises e workouts: os `unique (user_id, hevy_*)` já servem de índice.

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Mesmo padrão da v1: só `authenticated`, `(select auth.uid())` avaliado uma vez.

revoke all on table public.profiles, public.foods, public.meal_log_items from anon, public;
grant select, insert, update, delete on table public.profiles, public.foods, public.meal_log_items to authenticated;
grant all on table public.profiles, public.foods, public.meal_log_items to service_role;

alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.meal_log_items enable row level security;

create policy "dono acessa o próprio perfil" on public.profiles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Exceção documentada (techspec): a TACO (user_id nulo) é dado público de referência,
-- legível por qualquer usuário logado. Escrita só nas linhas próprias.
create policy "lê a TACO e os próprios alimentos" on public.foods
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

create policy "cria os próprios alimentos" on public.foods
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "altera os próprios alimentos" on public.foods
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "apaga os próprios alimentos" on public.foods
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- `food_id` aponta para a TACO ou para um alimento do próprio dono: a subconsulta
-- passa pelo RLS de `foods`, então alimento alheio é invisível e a gravação é barrada.
create policy "dono acessa os próprios itens" on public.meal_log_items
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (food_id is null or exists (select 1 from public.foods f where f.id = food_id))
  );
