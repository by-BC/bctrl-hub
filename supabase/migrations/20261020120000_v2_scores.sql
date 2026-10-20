-- Bctrl Hub v2: pontuação do dia ("dia no controle") e resumo mensal do Perfil.
-- As duas RPCs são `security invoker` (rodam como o usuário logado e passam pelo RLS),
-- com `search_path = ''` e tudo qualificado com o schema.

-- ── daily_scores ──────────────────────────────────────────────────────────
-- Uma linha por dia de `p_from` a `p_to` (no máximo 400 dias por chamada). Dias depois de
-- hoje (America/Sao_Paulo) não são devolvidos. Critérios, 1 ponto cada (iguais a
-- src/lib/domain/score.ts):
-- * trained: treino finalizado no dia (`workouts.day`) ou registro de cardio (hábito `cardio`);
-- * diet:    adesão ≥ 80%, com a regra do `week_summary` (diárias todo dia + "só dia de treino"
--            nos dias com treino finalizado; feitas = registros dentro do plano dessas refeições);
--            sem refeição prevista, não conta;
-- * habits:  todos os hábitos diários (`period = 'day'`) ativos NAQUELE dia cumpridos
--            (check: algum registro; quantidade/cardio: soma ≥ meta). Ativo no dia = criado até
--            o dia e não arquivado até ele (em São Paulo), para que criar ou arquivar um hábito
--            não reescreva o passado. Sem nenhum hábito diário ativo, o critério NÃO conta:
--            o ponto é por cumprir hábitos, não pela ausência deles;
-- * tasks:   pelo menos 1 tarefa com `done_at` no dia (em São Paulo).
-- Também devolve os fatos do dia que as conquistas usam (treinos, volume sem aquecimento,
-- melhor sessão, PRs e refeições previstas/feitas).

create function public.daily_scores(p_from date, p_to date)
returns table (
  day date,
  trained boolean,
  diet boolean,
  habits boolean,
  tasks boolean,
  score int,
  workouts int,
  volume_kg numeric,
  best_session_kg numeric,
  prs int,
  meals_planned int,
  meals_done int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_to date;
begin
  if v_uid is null then
    raise exception 'Sessão expirada: faça login novamente.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Intervalo inválido (% a %).', p_from, p_to using errcode = '22023';
  end if;
  if p_to - p_from + 1 > 400 then
    raise exception 'No máximo 400 dias por chamada (pedido: %).', p_to - p_from + 1 using errcode = '22023';
  end if;

  v_to := least(p_to, v_today);
  if v_to < p_from then
    return;
  end if;

  return query
  with
  days as (
    select g::date as day from generate_series(p_from, v_to, interval '1 day') g
  ),
  sessions as (
    select
      w.id,
      w.day,
      coalesce(sum(s.weight_kg * s.reps) filter (where s.set_type <> 'warmup'), 0) as volume,
      coalesce(sum(cardinality(s.pr_kinds)) filter (where s.set_type <> 'warmup'), 0)::int as prs
    from public.workouts w
    left join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
    left join public.workout_sets s on s.workout_exercise_id = we.id and s.user_id = we.user_id
    where w.user_id = v_uid and w.finished_at is not null and w.day between p_from and v_to
    group by w.id, w.day
  ),
  workout_days as (
    select s.day, count(*)::int as n, sum(s.volume) as volume, max(s.volume) as best, sum(s.prs)::int as prs
    from sessions s
    group by s.day
  ),
  cardio_days as (
    select distinct l.day
    from public.habit_logs l
    join public.habits h on h.id = l.habit_id and h.user_id = l.user_id
    where l.user_id = v_uid and h.kind = 'cardio' and l.day between p_from and v_to
  ),
  plan as (
    select
      count(*) filter (where not m.training_day_only)::int as daily,
      count(*) filter (where m.training_day_only)::int as training_only
    from public.meals m
    where m.user_id = v_uid
  ),
  meal_days as (
    select
      l.day,
      count(*) filter (where not m.training_day_only)::int as done_daily,
      count(*) filter (where m.training_day_only)::int as done_training
    from public.meal_logs l
    join public.meals m on m.id = l.meal_id and m.user_id = l.user_id
    where l.user_id = v_uid and not l.off_plan and l.day between p_from and v_to
    group by l.day
  ),
  daily_habits as (
    select
      h.id,
      h.kind,
      h.target,
      (h.created_at at time zone 'America/Sao_Paulo')::date as since,
      (h.archived_at at time zone 'America/Sao_Paulo')::date as until
    from public.habits h
    where h.user_id = v_uid and h.period = 'day'
  ),
  habit_totals as (
    select l.habit_id, l.day, sum(l.value) as total
    from public.habit_logs l
    join daily_habits h on h.id = l.habit_id
    where l.user_id = v_uid and l.day between p_from and v_to
    group by l.habit_id, l.day
  ),
  habit_days as (
    select
      d.day,
      count(*)::int as active,
      count(*) filter (
        where t.habit_id is not null and (h.kind = 'check' or t.total >= h.target)
      )::int as met
    from days d
    join daily_habits h on h.since <= d.day and (h.until is null or h.until > d.day)
    left join habit_totals t on t.habit_id = h.id and t.day = d.day
    group by d.day
  ),
  task_days as (
    select distinct (t.done_at at time zone 'America/Sao_Paulo')::date as day
    from public.tasks t
    where t.user_id = v_uid
      and t.done_at >= (p_from::timestamp at time zone 'America/Sao_Paulo')
      and t.done_at < ((v_to + 1)::timestamp at time zone 'America/Sao_Paulo')
  ),
  per_day as (
    select
      d.day,
      (wd.day is not null or cd.day is not null) as trained,
      (p.daily + case when wd.day is not null then p.training_only else 0 end) as meals_planned,
      (coalesce(md.done_daily, 0) + case when wd.day is not null then coalesce(md.done_training, 0) else 0 end)
        as meals_done,
      coalesce(hd.active, 0) > 0 and hd.met = hd.active as habits,
      td.day is not null as tasks,
      coalesce(wd.n, 0) as workouts,
      coalesce(wd.volume, 0) as volume_kg,
      coalesce(wd.best, 0) as best_session_kg,
      coalesce(wd.prs, 0) as prs
    from days d
    cross join plan p
    left join workout_days wd on wd.day = d.day
    left join cardio_days cd on cd.day = d.day
    left join meal_days md on md.day = d.day
    left join habit_days hd on hd.day = d.day
    left join task_days td on td.day = d.day
  )
  select
    x.day,
    x.trained,
    x.diet,
    x.habits,
    x.tasks,
    (x.trained::int + x.diet::int + x.habits::int + x.tasks::int) as score,
    x.workouts,
    x.volume_kg,
    x.best_session_kg,
    x.prs,
    x.meals_planned,
    x.meals_done
  from (
    select
      pd.*,
      -- ≥ 80% sem ponto flutuante: feitas × 5 ≥ previstas × 4.
      (pd.meals_planned > 0 and pd.meals_done * 5 >= pd.meals_planned * 4) as diet
    from per_day pd
  ) x
  order by x.day;
end
$$;

comment on function public.daily_scores(date, date) is
  'Pontuação "dia no controle" (0–4) por dia, em America/Sao_Paulo, até 400 dias e sem dias futuros. Ver src/lib/domain/score.ts.';

-- ── month_summary ─────────────────────────────────────────────────────────
-- Números do mês de `p_month` (qualquer dia do mês) e do mês anterior, contando só até hoje:
-- { month, current: Números, previous: Números }, com
-- Números = {
--   month, days (dias contados), workouts, volume_kg (sem aquecimento),
--   prs: { count, list: [{ day, exercise_id, exercise, kind, value, weight_kg, reps, distance_m, duration_s }] },
--   control_days (pontuação ≥ 3), meals: { planned, done, pct } (adesão do mês, regra do week_summary),
--   cardio: { minutes, distance_km, sessions },
--   nutrition: { logged_days, training_days, options: [{ option_id, count }], off_plan: { kcal, protein, carbs, fat } }
-- }
-- kcal e proteína médias: as opções do plano têm macros calculados no cliente (nutrition.ts,
-- a partir dos itens e da TACO), então a RPC devolve quantas vezes cada opção foi marcada nos
-- dias com registro e o total fora do plano; `monthNutrition` faz a média e compara com a meta
-- (`goalsFromProfile`). Só entram refeições previstas no dia (o pós-treino só em dia de treino).

create function public.month_summary(p_month date)
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
  -- Último dia contado: fim do mês atual ou hoje, o que vier antes.
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
  -- Registros de refeições previstas no dia (o pós-treino só conta em dia de treino).
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
        )
      ) as body
    from months m
    join score_month sm on sm.start = m.start
    join cardio_month cm on cm.start = m.start
    join nutrition_days nd on nd.start = m.start
    left join off_plan op on op.start = m.start
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
  'Resumo do mês (e do anterior) para o Perfil: treinos, volume, PRs, dias no controle, adesão, cardio e dados para kcal/proteína × meta.';

-- Só usuários logados chamam as RPCs.
revoke all on function public.daily_scores(date, date) from public, anon;
revoke all on function public.month_summary(date) from public, anon;
grant execute on function public.daily_scores(date, date) to authenticated, service_role;
grant execute on function public.month_summary(date) to authenticated, service_role;
