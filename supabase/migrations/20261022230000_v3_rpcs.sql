-- Bctrl Hub v3, task 5.0: composição corporal no resumo mensal.
-- Mantém o contrato da v2 e acrescenta `composition` em current/previous.

create or replace function public.month_summary(p_month date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_cur date;
  v_prev date;
  v_last date;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'Sessão expirada: faça login novamente.' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'Mês obrigatório.' using errcode = '22023';
  end if;

  v_cur := date_trunc('month', p_month)::date;
  v_prev := (v_cur - interval '1 month')::date;
  v_last := least((v_cur + interval '1 month')::date - 1, v_today);

  with
  months as (
    select m.start, least((m.start + interval '1 month')::date - 1, v_today) as last
    from (values (v_prev), (v_cur)) as m(start)
  ),
  scores as (
    select s.*
    from public.daily_scores(v_prev, greatest(v_last, v_prev)) s
    where v_last >= v_prev
  ),
  score_month as (
    select
      m.start,
      count(s.day)::int as days,
      coalesce(sum(s.workouts), 0)::int as workouts,
      coalesce(sum(s.volume_kg), 0) as volume_kg,
      coalesce(sum(s.prs), 0)::int as prs,
      count(*) filter (where s.score >= 3)::int as control_days,
      coalesce(sum(s.meals_planned), 0)::int as planned,
      coalesce(sum(s.meals_done), 0)::int as done
    from months m
    left join scores s on s.day between m.start and m.last
    group by m.start
  ),
  pr_rows as (
    select
      date_trunc('month', w.day)::date as start,
      w.day,
      w.started_at,
      we.position as exercise_pos,
      s.position as set_pos,
      k.ord,
      we.exercise_id,
      e.name as exercise,
      k.kind,
      case k.kind
        when 'weight' then s.weight_kg
        when 'volume' then s.weight_kg * s.reps
        when 'e1rm' then round(case when s.reps <= 1 then s.weight_kg else s.weight_kg * (1 + s.reps / 30.0) end, 2)
        when 'duration' then s.duration_s
        when 'distance' then s.distance_m
      end as value,
      s.weight_kg,
      s.reps,
      s.distance_m,
      s.duration_s
    from public.workouts w
    join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
    join public.exercises e on e.id = we.exercise_id and e.user_id = we.user_id
    join public.workout_sets s on s.workout_exercise_id = we.id and s.user_id = we.user_id
    cross join lateral unnest(s.pr_kinds) with ordinality as k(kind, ord)
    where w.user_id = v_uid and w.finished_at is not null and s.set_type <> 'warmup'
      and w.day between v_prev and v_last
  ),
  cardio_month as (
    select
      m.start,
      coalesce(sum(l.value), 0) as minutes,
      coalesce(sum(l.distance_km), 0) as distance_km,
      count(l.id)::int as sessions
    from months m
    left join (
      public.habit_logs l
      join public.habits h on h.id = l.habit_id and h.user_id = l.user_id and h.kind = 'cardio'
    ) on l.user_id = v_uid and l.day between m.start and m.last
    group by m.start
  ),
  visible_logs as (
    select
      date_trunc('month', l.day)::date as start,
      l.id,
      l.day,
      l.option_id,
      l.off_plan,
      (s.workouts > 0) as training
    from public.meal_logs l
    join public.meals m on m.id = l.meal_id and m.user_id = l.user_id
    join scores s on s.day = l.day
    where l.user_id = v_uid and (not m.training_day_only or s.workouts > 0)
  ),
  nutrition_days as (
    select
      m.start,
      count(distinct v.day)::int as logged_days,
      count(distinct v.day) filter (where v.training)::int as training_days
    from months m
    left join visible_logs v on v.start = m.start
    group by m.start
  ),
  option_counts as (
    select v.start, v.option_id, count(*)::int as n
    from visible_logs v
    where not v.off_plan and v.option_id is not null
    group by v.start, v.option_id
  ),
  off_plan as (
    select
      v.start,
      sum(i.kcal) as kcal,
      sum(i.protein_g) as protein,
      sum(i.carbs_g) as carbs,
      sum(i.fat_g) as fat
    from visible_logs v
    join public.meal_log_items i on i.meal_log_id = v.id and i.user_id = v_uid
    group by v.start
  ),
  composition_edges as (
    select
      date_trunc('month', bm.day)::date as start,
      count(*)::int as n,
      (array_agg(bm.day order by bm.measured_at))[1] as first_day,
      (array_agg(bm.day order by bm.measured_at desc))[1] as last_day,
      (array_agg(bm.weight_kg order by bm.measured_at))[1] as first_weight,
      (array_agg(bm.weight_kg order by bm.measured_at desc))[1] as last_weight,
      (array_agg(bm.body_fat_pct order by bm.measured_at))[1] as first_fat,
      (array_agg(bm.body_fat_pct order by bm.measured_at desc))[1] as last_fat,
      (array_agg(bm.skeletal_muscle_kg order by bm.measured_at))[1] as first_muscle,
      (array_agg(bm.skeletal_muscle_kg order by bm.measured_at desc))[1] as last_muscle
    from public.body_measurements bm
    where bm.user_id = v_uid and bm.day between v_prev and v_last
    group by date_trunc('month', bm.day)::date
  ),
  numbers as (
    select
      m.start,
      jsonb_build_object(
        'month', m.start,
        'days', sm.days,
        'workouts', sm.workouts,
        'volume_kg', sm.volume_kg,
        'prs', jsonb_build_object(
          'count', sm.prs,
          'list', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'day', p.day, 'exercise_id', p.exercise_id, 'exercise', p.exercise, 'kind', p.kind,
                'value', p.value, 'weight_kg', p.weight_kg, 'reps', p.reps,
                'distance_m', p.distance_m, 'duration_s', p.duration_s
              ) order by p.day, p.started_at, p.exercise_pos, p.set_pos, p.ord
            )
            from pr_rows p where p.start = m.start
          ), '[]'::jsonb)
        ),
        'control_days', sm.control_days,
        'meals', jsonb_build_object(
          'planned', sm.planned,
          'done', sm.done,
          'pct', case when sm.planned = 0 then 0 else round(sm.done * 100.0 / sm.planned) end
        ),
        'cardio', jsonb_build_object(
          'minutes', cm.minutes, 'distance_km', cm.distance_km, 'sessions', cm.sessions
        ),
        'nutrition', jsonb_build_object(
          'logged_days', nd.logged_days,
          'training_days', nd.training_days,
          'options', coalesce((
            select jsonb_agg(jsonb_build_object('option_id', o.option_id, 'count', o.n) order by o.option_id)
            from option_counts o where o.start = m.start
          ), '[]'::jsonb),
          'off_plan', jsonb_build_object(
            'kcal', coalesce(op.kcal, 0),
            'protein', coalesce(op.protein, 0),
            'carbs', coalesce(op.carbs, 0),
            'fat', coalesce(op.fat, 0)
          )
        ),
        'composition', case when ce.n is null then null else jsonb_build_object(
          'count', ce.n,
          'first', jsonb_build_object(
            'day', ce.first_day,
            'weight_kg', ce.first_weight,
            'body_fat_pct', ce.first_fat,
            'skeletal_muscle_kg', ce.first_muscle
          ),
          'last', jsonb_build_object(
            'day', ce.last_day,
            'weight_kg', ce.last_weight,
            'body_fat_pct', ce.last_fat,
            'skeletal_muscle_kg', ce.last_muscle
          ),
          'change', jsonb_build_object(
            'weight_kg', ce.last_weight - ce.first_weight,
            'body_fat_pct', case when ce.first_fat is null or ce.last_fat is null then null else ce.last_fat - ce.first_fat end,
            'skeletal_muscle_kg', case when ce.first_muscle is null or ce.last_muscle is null then null else ce.last_muscle - ce.first_muscle end
          )
        ) end
      ) as body
    from months m
    join score_month sm on sm.start = m.start
    join cardio_month cm on cm.start = m.start
    join nutrition_days nd on nd.start = m.start
    left join off_plan op on op.start = m.start
    left join composition_edges ce on ce.start = m.start
  )
  select jsonb_build_object(
    'month', v_cur,
    'current', (select n.body from numbers n where n.start = v_cur),
    'previous', (select n.body from numbers n where n.start = v_prev)
  )
  into v_result;

  return v_result;
end
$$;

comment on function public.month_summary(date) is
  'Resumo do mês e do anterior para o Perfil, incluindo primeira, última e variação da composição corporal.';

revoke all on function public.month_summary(date) from public, anon;
grant execute on function public.month_summary(date) to authenticated, service_role;
