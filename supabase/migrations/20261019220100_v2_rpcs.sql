-- Bctrl Hub v2: views de estatística e `finish_workout` com tipos de série.
--
-- Regras (iguais a src/lib/domain/workout.ts):
-- * aquecimento (`set_type = 'warmup'`) fica fora de tudo (recordes, volume, anterior);
-- * carga, 1RM (Epley) e volume só com `weight_kg` e `reps` preenchidos;
-- * duração e distância ganham melhor marca própria.
-- `create or replace` mantém nomes, tipos e ordem das colunas da v1 (as novas vão no fim)
-- e as permissões já concedidas.

create or replace view public.v_exercise_session_stats
with (security_invoker = true)
as
select
  w.user_id,
  w.id as workout_id,
  we.exercise_id,
  w.day,
  w.started_at,
  max(s.weight_kg) filter (where s.weight_kg is not null and s.reps is not null) as best_weight,
  round(
    max(case when s.reps <= 1 then s.weight_kg else s.weight_kg * (1 + s.reps / 30.0) end)
      filter (where s.weight_kg is not null and s.reps is not null),
    2
  ) as best_e1rm,
  sum(s.weight_kg * s.reps) as volume,
  count(*)::int as sets,
  max(s.duration_s) as best_duration_s,
  max(s.distance_m) as best_distance_m,
  sum(s.duration_s)::int as total_duration_s,
  sum(s.distance_m) as total_distance_m
from public.workouts w
join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
join public.workout_sets s on s.workout_exercise_id = we.id and s.user_id = we.user_id
where w.finished_at is not null and s.set_type <> 'warmup'
group by w.user_id, w.id, we.exercise_id, w.day, w.started_at;

comment on view public.v_exercise_session_stats is
  'Por (treino, exercício), sem aquecimento: melhor carga, e1RM e volume (só séries com carga e reps), duração e distância. Alimenta os gráficos de evolução.';

create or replace view public.v_exercise_bests
with (security_invoker = true)
as
select
  we.user_id,
  we.exercise_id,
  max(s.weight_kg) filter (where s.weight_kg is not null and s.reps is not null) as max_weight,
  max(s.weight_kg * s.reps) as max_set_volume,
  round(
    max(case when s.reps <= 1 then s.weight_kg else s.weight_kg * (1 + s.reps / 30.0) end)
      filter (where s.weight_kg is not null and s.reps is not null),
    2
  ) as max_e1rm,
  max(s.duration_s) as max_duration_s,
  max(s.distance_m) as max_distance_m
from public.workouts w
join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
join public.workout_sets s on s.workout_exercise_id = we.id and s.user_id = we.user_id
where w.finished_at is not null and s.set_type <> 'warmup'
group by we.user_id, we.exercise_id;

comment on view public.v_exercise_bests is
  'Recordes por exercício, sem aquecimento (carga, volume numa série, e1RM, duração, distância). Alimenta a detecção de PR.';

create or replace view public.v_exercise_last_sets
with (security_invoker = true)
as
with ranked as (
  select
    we.user_id,
    we.exercise_id,
    w.id as workout_id,
    w.day,
    w.started_at,
    we.id as workout_exercise_id,
    dense_rank() over (partition by we.user_id, we.exercise_id order by w.started_at desc, w.id desc) as recency
  from public.workouts w
  join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
  where w.finished_at is not null
    -- Ocorrência só com aquecimento não vira "anterior".
    and exists (
      select 1 from public.workout_sets x
      where x.workout_exercise_id = we.id and x.user_id = we.user_id and x.set_type <> 'warmup'
    )
)
select
  r.user_id,
  r.exercise_id,
  r.workout_id,
  r.day,
  r.started_at,
  r.workout_exercise_id,
  -- Posição contínua entre as séries de trabalho (1, 2, 3…), mesmo se o exercício apareceu duas vezes.
  row_number() over (partition by r.user_id, r.exercise_id order by we.position, s.position)::int as position,
  s.weight_kg,
  s.reps,
  s.distance_m,
  s.duration_s
from ranked r
join public.workout_exercises we on we.id = r.workout_exercise_id
join public.workout_sets s on s.workout_exercise_id = r.workout_exercise_id and s.user_id = r.user_id
where r.recency = 1 and s.set_type <> 'warmup';

comment on view public.v_exercise_last_sets is
  'Séries de trabalho (sem aquecimento) da última sessão finalizada de cada exercício. Alimenta a coluna "anterior".';

-- ── finish_workout ────────────────────────────────────────────────────────
-- Igual à v1 (transacional e idempotente pelo id), com as séries v2:
-- sets: [{ "id"?: uuid, "set_type"?: 'normal'|'warmup'|'failure'|'dropset',
--          "weight_kg"?: number|null, "reps"?: int|null, "distance_m"?: number|null,
--          "duration_s"?: int|null, "pr_kinds"?: text[] }]
-- O payload da v1 (só weight_kg e reps) continua válido: set_type vira 'normal'.
-- Série sem nenhuma métrica, tipo desconhecido ou valor negativo falha no check e
-- desfaz o treino inteiro.

create or replace function public.finish_workout(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := (payload ->> 'id')::uuid;
  v_inserted uuid;
  v_exercise jsonb;
  v_exercise_pos bigint;
  v_workout_exercise_id uuid;
begin
  if v_uid is null then
    raise exception 'Sessão expirada: faça login novamente.' using errcode = '42501';
  end if;
  if v_id is null then
    raise exception 'payload.id é obrigatório.' using errcode = '22023';
  end if;
  if payload ->> 'finished_at' is null then
    raise exception 'payload.finished_at é obrigatório.' using errcode = '22023';
  end if;
  if jsonb_typeof(payload -> 'exercises') is distinct from 'array'
     or jsonb_array_length(payload -> 'exercises') = 0 then
    raise exception 'O treino precisa de ao menos um exercício.' using errcode = '22023';
  end if;

  insert into public.workouts (id, user_id, routine_id, started_at, finished_at, day, notes)
  values (
    v_id,
    v_uid,
    (payload ->> 'routine_id')::uuid,
    (payload ->> 'started_at')::timestamptz,
    (payload ->> 'finished_at')::timestamptz,
    (payload ->> 'day')::date,
    payload ->> 'notes'
  )
  on conflict (id) do nothing
  returning id into v_inserted;

  if v_inserted is null then
    -- Reenvio do mesmo treino: o RLS só deixa ver se for do próprio usuário.
    if exists (select 1 from public.workouts w where w.id = v_id) then
      return v_id;
    end if;
    raise exception 'Id de treino já usado.' using errcode = '23505';
  end if;

  for v_exercise, v_exercise_pos in
    select e.value, e.ordinality from jsonb_array_elements(payload -> 'exercises') with ordinality e
  loop
    if jsonb_typeof(v_exercise -> 'sets') is distinct from 'array'
       or jsonb_array_length(v_exercise -> 'sets') = 0 then
      raise exception 'Exercício % sem séries.', v_exercise_pos using errcode = '22023';
    end if;

    insert into public.workout_exercises (id, user_id, workout_id, exercise_id, position, notes)
    values (
      coalesce((v_exercise ->> 'id')::uuid, gen_random_uuid()),
      v_uid,
      v_id,
      (v_exercise ->> 'exercise_id')::uuid,
      v_exercise_pos,
      v_exercise ->> 'notes'
    )
    returning id into v_workout_exercise_id;

    insert into public.workout_sets (
      id, user_id, workout_exercise_id, position, set_type, weight_kg, reps, distance_m, duration_s, pr_kinds
    )
    select
      coalesce((s.value ->> 'id')::uuid, gen_random_uuid()),
      v_uid,
      v_workout_exercise_id,
      s.ordinality,
      coalesce(s.value ->> 'set_type', 'normal'),
      (s.value ->> 'weight_kg')::numeric,
      (s.value ->> 'reps')::int, -- "8.5" falha aqui: reps são inteiras
      (s.value ->> 'distance_m')::numeric,
      (s.value ->> 'duration_s')::int,
      coalesce(
        array(select jsonb_array_elements_text(s.value -> 'pr_kinds')),
        '{}'
      )
    from jsonb_array_elements(v_exercise -> 'sets') with ordinality s;
  end loop;

  return v_id;
end
$$;

comment on function public.finish_workout(jsonb) is
  'Grava um treino finalizado de forma transacional e idempotente (pelo id). Aceita séries v2 (set_type, distance_m, duration_s) e o payload da v1. Ver src/lib/schemas/workout.ts.';
