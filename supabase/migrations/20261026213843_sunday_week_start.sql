-- O app agora agrupa hábitos, treinos e alimentação em semanas de domingo a sábado.
create or replace function public.week_summary(p_week_start date)
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
  if p_week_start is null or extract(dow from p_week_start) <> 0 then
    raise exception 'A semana começa no domingo (recebido: %).', p_week_start using errcode = '22023';
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
  'Resumo da semana (domingo a sábado): treinos, cardio, abdominais, suplementos, adesão alimentar e hábitos.';
