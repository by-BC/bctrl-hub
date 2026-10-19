-- Bctrl Hub: esquema base (13 tabelas).
--
-- Convenções:
-- * `id uuid` com default, mas o cliente pode mandar o próprio (gravações idempotentes).
-- * `user_id` preenchido por `auth.uid()` e apagado em cascata com o usuário.
-- * FKs entre tabelas do app são compostas com `user_id`: uma linha nunca aponta
--   para a linha de outro usuário, mesmo que alguém descubra o id.
-- * Datas de "dia" são `date` calculadas no cliente (America/Sao_Paulo).

-- ── Treino ────────────────────────────────────────────────────────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  muscle_group text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  position int not null default 0,
  notes text,
  rest_sec int not null default 120 check (rest_sec between 0 and 3600),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null,
  exercise_id uuid not null,
  position int not null default 0,
  sets int not null default 3 check (sets between 1 and 20),
  rest_sec int check (rest_sec between 0 and 3600), -- null = descanso da rotina
  notes text,
  created_at timestamptz not null default now(),
  foreign key (routine_id, user_id) references public.routines (id, user_id) on delete cascade,
  foreign key (exercise_id, user_id) references public.exercises (id, user_id) on delete cascade
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid,
  started_at timestamptz not null,
  finished_at timestamptz,
  day date not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (finished_at is null or finished_at >= started_at),
  -- Excluir a rotina mantém o histórico: zera só routine_id (user_id continua).
  foreign key (routine_id, user_id) references public.routines (id, user_id) on delete set null (routine_id)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  position int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade,
  -- Exercício com histórico não pode sumir da biblioteca (no action: só a cascata do usuário passa).
  foreign key (exercise_id, user_id) references public.exercises (id, user_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null,
  position int not null default 0,
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps int not null check (reps > 0),
  pr_kinds text[] not null default '{}' check (pr_kinds <@ array['weight', 'volume', 'e1rm']),
  created_at timestamptz not null default now(),
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

-- ── Alimentação ───────────────────────────────────────────────────────────

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  time time,
  position int not null default 0,
  training_day_only boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.meal_options (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_id uuid not null,
  position int not null default 0,
  title text not null check (length(btrim(title)) between 1 and 120),
  -- [{ "name": "Ovo", "qty": "4 un (200 g)", "subs": ["Frango 90 g"] }]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  unique (id, meal_id, user_id),
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade
);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  meal_id uuid not null,
  option_id uuid, -- a opção precisa ser da mesma refeição
  off_plan boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, day, meal_id),
  foreign key (meal_id, user_id) references public.meals (id, user_id) on delete cascade,
  foreign key (option_id, meal_id, user_id)
    references public.meal_options (id, meal_id, user_id) on delete set null (option_id)
);

-- ── Hábitos e tarefas ─────────────────────────────────────────────────────

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  kind text not null check (kind in ('check', 'quantity', 'cardio')),
  period text not null check (period in ('day', 'week')),
  target numeric not null check (target > 0),
  unit text,
  -- Hábitos do sistema (seed): não podem ser excluídos nem perder a chave.
  -- O hábito "Treino" não existe aqui: é derivado de `workouts`.
  system_key text check (system_key in ('cardio', 'abs', 'supplements')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, system_key)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  day date not null,
  value numeric not null default 1 check (value >= 0), -- check: 1; quantidade/cardio: minutos etc.
  cardio_type text check (cardio_type in ('treadmill', 'bike', 'stairs', 'walk', 'run', 'other')),
  distance_km numeric(6, 2) check (distance_km >= 0),
  kcal int check (kcal >= 0),
  created_at timestamptz not null default now(),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 500),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── Índices ───────────────────────────────────────────────────────────────
-- `user_id` em todas (RLS filtra por ele); FKs compostas e colunas de dia.

create index routines_user_id_idx on public.routines (user_id, position);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id, user_id, position);
create index routine_exercises_exercise_idx on public.routine_exercises (exercise_id, user_id);
create index routine_exercises_user_id_idx on public.routine_exercises (user_id);
create index workouts_user_day_idx on public.workouts (user_id, day);
create index workouts_routine_idx on public.workouts (routine_id, user_id);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, user_id, position);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id, user_id);
create index workout_exercises_user_id_idx on public.workout_exercises (user_id);
create index workout_sets_workout_exercise_idx on public.workout_sets (workout_exercise_id, user_id, position);
create index workout_sets_user_id_idx on public.workout_sets (user_id);
create index meals_user_id_idx on public.meals (user_id, position);
create index meal_options_meal_idx on public.meal_options (meal_id, user_id, position);
create index meal_options_user_id_idx on public.meal_options (user_id);
create index meal_logs_meal_idx on public.meal_logs (meal_id, user_id);
create index meal_logs_option_idx on public.meal_logs (option_id, meal_id, user_id);
create index meal_logs_user_day_idx on public.meal_logs (user_id, day);
create index habit_logs_habit_idx on public.habit_logs (habit_id, user_id, day);
create index habit_logs_user_day_idx on public.habit_logs (user_id, day);
create index tasks_user_id_idx on public.tasks (user_id, done_at);
-- exercises, body_weights, meal_logs e habits já têm índice por user_id via `unique (user_id, …)`.
