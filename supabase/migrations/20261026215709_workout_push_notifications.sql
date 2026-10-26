-- Web Push subscriptions and durable rest timer notifications.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.workout_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index workout_push_subscriptions_user_id_idx
  on public.workout_push_subscriptions (user_id);

alter table public.workout_push_subscriptions enable row level security;
create policy "usuário acessa apenas suas assinaturas push"
  on public.workout_push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.workout_push_subscriptions to authenticated;

create table public.workout_rest_push_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null,
  ends_at timestamptz not null,
  next_attempt_at timestamptz not null,
  exercise_name text not null,
  next_set_number integer,
  status text not null default 'pending' check (status in ('pending', 'processing')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, workout_id)
);

create index workout_rest_push_jobs_due_idx
  on public.workout_rest_push_jobs (next_attempt_at)
  where status = 'pending';
create index workout_rest_push_jobs_locked_idx
  on public.workout_rest_push_jobs (locked_until)
  where status = 'processing';

alter table public.workout_rest_push_jobs enable row level security;
create policy "usuário gerencia apenas seus avisos de descanso"
  on public.workout_rest_push_jobs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.workout_rest_push_jobs to authenticated;

-- The cron token is generated in the database and never enters the repository.
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'workout_rest_push_cron_token',
  'Authenticates the scheduled workout rest push dispatcher',
  null
);

create or replace function public.get_workout_rest_push_config(p_cron_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (
    select 1 from vault.decrypted_secrets
    where name = 'workout_rest_push_cron_token'
      and decrypted_secret = p_cron_token
  ) then jsonb_build_object(
    'vapid_private_key', (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'workout_rest_push_vapid_private_key'
    ),
    'vapid_subject', (
      select decrypted_secret from vault.decrypted_secrets
      where name = 'workout_rest_push_vapid_subject'
    )
  ) else null end;
$$;
revoke all on function public.get_workout_rest_push_config(text) from public, anon, authenticated;
grant execute on function public.get_workout_rest_push_config(text) to service_role;

create or replace function public.claim_due_workout_rest_push_jobs(p_limit integer default 25)
returns setof public.workout_rest_push_jobs
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select j.id
    from public.workout_rest_push_jobs as j
    where (j.status = 'pending' and j.next_attempt_at <= now())
       or (j.status = 'processing' and j.locked_until < now())
    order by j.next_attempt_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 50))
  )
  update public.workout_rest_push_jobs as j
  set status = 'processing', locked_until = now() + interval '1 minute'
  from due
  where j.id = due.id
  returning j.*;
$$;
revoke all on function public.claim_due_workout_rest_push_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_workout_rest_push_jobs(integer) to service_role;

-- Deliver every 10 seconds; edge logic only claims jobs whose rest has elapsed.
select cron.schedule(
  'workout-rest-push-dispatch',
  '10 seconds',
  $$
    select net.http_post(
      url := 'https://ubnyhgpvytnxechyioez.supabase.co/functions/v1/workout-rest-push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'workout_rest_push_cron_token')
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 5000
    );
  $$
);
