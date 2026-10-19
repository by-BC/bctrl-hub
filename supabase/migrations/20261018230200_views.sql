-- Bctrl Hub: views de estatística por exercício.
-- `security_invoker = true`: a view roda com as permissões de quem consulta, então
-- herda o RLS das tabelas (cada usuário só vê as próprias séries).
-- Só contam treinos finalizados. e1RM pela fórmula de Epley (igual a
-- `src/lib/domain/workout.ts`): reps <= 1 → carga; senão carga × (1 + reps/30).

create view public.v_exercise_session_stats
with (security_invoker = true)
as
select
  w.user_id,
  w.id as workout_id,
  we.exercise_id,
  w.day,
  w.started_at,
  max(s.weight_kg) as best_weight,
  round(max(case when s.reps <= 1 then s.weight_kg else s.weight_kg * (1 + s.reps / 30.0) end), 2) as best_e1rm,
  sum(s.weight_kg * s.reps) as volume,
  count(*)::int as sets
from public.workouts w
join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
join public.workout_sets s on s.workout_exercise_id = we.id and s.user_id = we.user_id
where w.finished_at is not null
group by w.user_id, w.id, we.exercise_id, w.day, w.started_at;

comment on view public.v_exercise_session_stats is
  'Por (treino, exercício): melhor carga, melhor e1RM e volume. Alimenta os gráficos de evolução.';

create view public.v_exercise_bests
with (security_invoker = true)
as
select
  we.user_id,
  we.exercise_id,
  max(s.weight_kg) as max_weight,
  max(s.weight_kg * s.reps) as max_set_volume,
  round(max(case when s.reps <= 1 then s.weight_kg else s.weight_kg * (1 + s.reps / 30.0) end), 2) as max_e1rm
from public.workouts w
join public.workout_exercises we on we.workout_id = w.id and we.user_id = w.user_id
join public.workout_sets s on s.workout_exercise_id = we.id and s.user_id = we.user_id
where w.finished_at is not null
group by we.user_id, we.exercise_id;

comment on view public.v_exercise_bests is
  'Recordes por exercício (carga, volume numa série, e1RM). Alimenta a detecção de PR.';

create view public.v_exercise_last_sets
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
)
select
  r.user_id,
  r.exercise_id,
  r.workout_id,
  r.day,
  r.started_at,
  r.workout_exercise_id,
  -- Posição contínua da série no exercício (1, 2, 3…), mesmo se ele apareceu duas vezes no treino.
  row_number() over (partition by r.user_id, r.exercise_id order by we.position, s.position)::int as position,
  s.weight_kg,
  s.reps
from ranked r
join public.workout_exercises we on we.id = r.workout_exercise_id
join public.workout_sets s on s.workout_exercise_id = r.workout_exercise_id and s.user_id = r.user_id
where r.recency = 1;

comment on view public.v_exercise_last_sets is
  'Séries da última sessão finalizada de cada exercício. Alimenta a coluna "anterior".';

revoke all on public.v_exercise_session_stats, public.v_exercise_bests, public.v_exercise_last_sets
  from anon, public;
grant select on public.v_exercise_session_stats, public.v_exercise_bests, public.v_exercise_last_sets
  to authenticated, service_role;
