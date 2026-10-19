-- Bctrl Hub: RPCs.
-- Ambas são `security invoker` (padrão): rodam como o usuário logado e passam pelo RLS.
-- `search_path = ''` evita sequestro de nomes; tudo é qualificado com o schema.

-- ── finish_workout ────────────────────────────────────────────────────────
-- Grava o treino inteiro (workouts + workout_exercises + workout_sets) numa transação.
-- Idempotente pelo `payload.id`: se o treino já existe, devolve o id sem regravar.
-- Qualquer erro (validação, constraint, FK) desfaz tudo: nunca fica treino pela metade.
--
-- payload (validado no cliente por `finishWorkoutSchema`, em src/lib/schemas/workout.ts):
-- {
--   "id": uuid, "routine_id": uuid | null, "started_at": timestamptz, "finished_at": timestamptz,
--   "day": date, "notes": text | null,
--   "exercises": [{ "id"?: uuid, "exercise_id": uuid, "notes"?: text,
--                   "sets": [{ "id"?: uuid, "weight_kg": number, "reps": int, "pr_kinds"?: text[] }] }]
-- }
-- A ordem dos arrays define `position` (1, 2, 3…).

create function public.finish_workout(payload jsonb)
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

    insert into public.workout_sets (id, user_id, workout_exercise_id, position, weight_kg, reps, pr_kinds)
    select
      coalesce((s.value ->> 'id')::uuid, gen_random_uuid()),
      v_uid,
      v_workout_exercise_id,
      s.ordinality,
      (s.value ->> 'weight_kg')::numeric,
      (s.value ->> 'reps')::int, -- "8.5" falha aqui: reps são inteiras
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
  'Grava um treino finalizado de forma transacional e idempotente (pelo id). Ver src/lib/schemas/workout.ts.';

-- ── week_summary ──────────────────────────────────────────────────────────
-- Resumo da semana (segunda a domingo) numa única ida ao banco, para o Hoje e o Hex Week.
-- Refeições previstas: as diárias todo dia + as de "só dia de treino" nos dias com treino
-- finalizado. Feitas: registros dentro do plano (off_plan = false) de refeições previstas.

create function public.week_summary(p_week_start date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_end date := p_week_start + 6;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sessão expirada: faça login novamente.' using errcode = '42501';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'A semana começa na segunda-feira (recebido: %).', p_week_start using errcode = '22023';
  end if;

  with
  days as (
    select d::date as day from generate_series(p_week_start, v_end, interval '1 day') d
  ),
  trained as (
    select distinct w.day
    from public.workouts w
    where w.user_id = v_uid and w.finished_at is not null and w.day between p_week_start and v_end
  ),
  plan as (
    select
      count(*) filter (where not m.training_day_only) as daily,
      count(*) filter (where m.training_day_only) as training_only
    from public.meals m
    where m.user_id = v_uid
  ),
  per_day as (
    select
      d.day,
      t.day is not null as trained,
      (p.daily + case when t.day is not null then p.training_only else 0 end)::int as meals_planned,
      (
        select count(*)::int
        from public.meal_logs l
        join public.meals m on m.id = l.meal_id
        where l.user_id = v_uid and l.day = d.day and not l.off_plan
          and (not m.training_day_only or t.day is not null)
      ) as meals_done
    from days d
    left join trained t on t.day = d.day
    cross join plan p
  ),
  habit_totals as (
    select
      h.id, h.name, h.kind, h.period, h.target, h.unit, h.system_key,
      case when h.period = 'day' then h.target * 7 else h.target end as week_target,
      case when h.kind = 'check' then count(distinct l.day) else coalesce(sum(l.value), 0) end as total,
      count(l.id)::int as sessions,
      coalesce(sum(l.distance_km), 0) as distance_km,
      coalesce(sum(l.kcal), 0)::int as kcal
    from public.habits h
    left join public.habit_logs l
      on l.habit_id = h.id and l.user_id = h.user_id and l.day between p_week_start and v_end
    where h.user_id = v_uid and h.archived_at is null
    group by h.id
  ),
  meals_week as (
    select coalesce(sum(meals_planned), 0)::int as planned, coalesce(sum(meals_done), 0)::int as done
    from per_day
  )
  select jsonb_build_object(
    'week_start', p_week_start,
    'week_end', v_end,
    'workouts', jsonb_build_object('done', (select count(*) from trained), 'target', 4),
    'cardio', (
      select jsonb_build_object(
        'minutes', coalesce(max(total), 0),
        'distance_km', coalesce(max(distance_km), 0),
        'kcal', coalesce(max(kcal), 0),
        'sessions', coalesce(max(sessions), 0),
        'target', max(week_target)
      )
      from habit_totals where system_key = 'cardio'
    ),
    'abs', (
      select jsonb_build_object('done', coalesce(max(total), 0), 'target', max(week_target))
      from habit_totals where system_key = 'abs'
    ),
    'supplements', (
      select jsonb_build_object('done', coalesce(max(total), 0), 'target', max(week_target))
      from habit_totals where system_key = 'supplements'
    ),
    'meals', (
      select jsonb_build_object(
        'planned', planned,
        'done', done,
        'pct', case when planned = 0 then 0 else round(done * 100.0 / planned) end
      )
      from meals_week
    ),
    'days', (
      select jsonb_agg(
        jsonb_build_object(
          'day', day, 'trained', trained, 'meals_planned', meals_planned, 'meals_done', meals_done
        ) order by day
      )
      from per_day
    ),
    'habits', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id, 'name', name, 'kind', kind, 'period', period, 'target', target, 'unit', unit,
          'system_key', system_key, 'week_target', week_target, 'total', total,
          'sessions', sessions, 'distance_km', distance_km, 'kcal', kcal
        ) order by system_key nulls last, name
      )
      from habit_totals
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end
$$;

comment on function public.week_summary(date) is
  'Resumo da semana (segunda a domingo): treinos, cardio, abdominais, suplementos, adesão alimentar e hábitos.';

-- Só usuários logados chamam as RPCs.
revoke all on function public.finish_workout(jsonb) from public, anon;
revoke all on function public.week_summary(date) from public, anon;
grant execute on function public.finish_workout(jsonb) to authenticated, service_role;
grant execute on function public.week_summary(date) to authenticated, service_role;
