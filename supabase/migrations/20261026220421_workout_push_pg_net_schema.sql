-- Move pg_net away from public as recommended by Supabase Security Advisor.
-- Before running, the request queue was confirmed empty; its response history only
-- contained this dispatcher's health checks and is automatically short-lived.
select cron.unschedule('workout-rest-push-dispatch');

drop extension pg_net;
create extension pg_net with schema extensions;

do $$
declare
  v_http_schema text;
  v_command text;
begin
  select n.nspname into v_http_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'http_post'
    and pg_get_function_identity_arguments(p.oid) like 'url text, body jsonb%'
  order by case when n.nspname = 'net' then 0 else 1 end
  limit 1;

  if v_http_schema is null then
    raise exception 'pg_net http_post function was not found after reinstall';
  end if;

  v_command := format($command$
    select %I.http_post(
      url := 'https://ubnyhgpvytnxechyioez.supabase.co/functions/v1/workout-rest-push-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'workout_rest_push_cron_token')
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 5000
    );
  $command$, v_http_schema);

  perform cron.schedule('workout-rest-push-dispatch', '10 seconds', v_command);
end;
$$;
