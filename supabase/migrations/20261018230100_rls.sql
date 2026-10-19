-- Bctrl Hub: segurança por linha.
-- Toda tabela: RLS ligado, uma política `for all` restrita ao dono e acesso só para
-- `authenticated` (o `anon` não enxerga nada). `(select auth.uid())` é avaliado uma
-- vez por consulta, não por linha (recomendação de performance do Supabase).

do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'routines', 'routine_exercises', 'workouts', 'workout_exercises',
    'workout_sets', 'body_weights', 'meals', 'meal_options', 'meal_logs',
    'habits', 'habit_logs', 'tasks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format(
      'create policy "dono acessa os próprios dados" on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end
$$;

-- ── Hábitos do sistema ────────────────────────────────────────────────────
-- `cardio`, `abs` e `supplements` alimentam o resumo da semana: podem ser editados,
-- mas não excluídos nem perder a `system_key`. A exclusão em cascata do próprio
-- usuário (auth.users → habits) continua permitida: ela chega aqui com
-- pg_trigger_depth() > 1, disparada pela FK.

create function public.protect_system_habits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null and pg_trigger_depth() = 1 then
      raise exception 'O hábito do sistema "%" não pode ser excluído.', old.name
        using errcode = 'P0001', hint = 'Arquive ou edite o hábito em vez de excluir.';
    end if;
    return old;
  end if;

  if new.system_key is distinct from old.system_key then
    raise exception 'A chave de sistema de um hábito não pode ser alterada.'
      using errcode = 'P0001';
  end if;
  return new;
end
$$;

revoke all on function public.protect_system_habits() from public, anon, authenticated;

create trigger habits_protect_system
before update or delete on public.habits
for each row execute function public.protect_system_habits();
