-- Seed de EXEMPLO do Bctrl Hub (dados fictícios, versionado). Usado pelo `supabase db reset` local.
-- O seed real (treino e dieta do dono) fica em supabase/seed.private.sql, fora do Git.
-- Mesma estrutura do real: 4 rotinas, 28 itens (26 exercícios únicos), 6 refeições
-- (uma só em dia de treino) e os 3 hábitos do sistema.

-- Usuário de testes locais (o mesmo de tests/support/e2e-user.ts). Só existe no Docker local.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-0000000000e2',
  'authenticated', 'authenticated', 'e2e@bctrl.test',
  extensions.crypt('e2e-local-only-123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
) on conflict do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now()
from auth.users u
where u.email = 'e2e@bctrl.test'
on conflict do nothing;

do $$
declare
  v_uid uuid := (select id from auth.users where email = 'e2e@bctrl.test');
begin
  if v_uid is null then
    raise exception 'Usuário de testes não encontrado em auth.users.';
  end if;

  -- Biblioteca de exercícios (unique por usuário + nome).
  insert into public.exercises (id, user_id, name, muscle_group) values
    (md5(v_uid::text || ':exercise:' || 'Supino reto')::uuid, v_uid, 'Supino reto', 'Peito'),
    (md5(v_uid::text || ':exercise:' || 'Crucifixo máquina')::uuid, v_uid, 'Crucifixo máquina', 'Peito'),
    (md5(v_uid::text || ':exercise:' || 'Remada unilateral')::uuid, v_uid, 'Remada unilateral', 'Costas'),
    (md5(v_uid::text || ':exercise:' || 'Puxada neutra')::uuid, v_uid, 'Puxada neutra', 'Costas'),
    (md5(v_uid::text || ':exercise:' || 'Elevação frontal')::uuid, v_uid, 'Elevação frontal', 'Ombros'),
    (md5(v_uid::text || ':exercise:' || 'Arnold press')::uuid, v_uid, 'Arnold press', 'Ombros'),
    (md5(v_uid::text || ':exercise:' || 'Tríceps francês')::uuid, v_uid, 'Tríceps francês', 'Tríceps'),
    (md5(v_uid::text || ':exercise:' || 'Rosca martelo')::uuid, v_uid, 'Rosca martelo', 'Bíceps'),
    (md5(v_uid::text || ':exercise:' || 'Agachamento livre')::uuid, v_uid, 'Agachamento livre', 'Quadríceps'),
    (md5(v_uid::text || ':exercise:' || 'Afundo')::uuid, v_uid, 'Afundo', 'Quadríceps'),
    (md5(v_uid::text || ':exercise:' || 'Cadeira adutora')::uuid, v_uid, 'Cadeira adutora', 'Adutores'),
    (md5(v_uid::text || ':exercise:' || 'Panturrilha no leg')::uuid, v_uid, 'Panturrilha no leg', 'Panturrilha'),
    (md5(v_uid::text || ':exercise:' || 'Bom dia')::uuid, v_uid, 'Bom dia', 'Posterior de coxa'),
    (md5(v_uid::text || ':exercise:' || 'Levantamento terra')::uuid, v_uid, 'Levantamento terra', 'Posterior de coxa'),
    (md5(v_uid::text || ':exercise:' || 'Barra fixa')::uuid, v_uid, 'Barra fixa', 'Costas'),
    (md5(v_uid::text || ':exercise:' || 'Remada máquina')::uuid, v_uid, 'Remada máquina', 'Costas'),
    (md5(v_uid::text || ':exercise:' || 'Pullover')::uuid, v_uid, 'Pullover', 'Costas'),
    (md5(v_uid::text || ':exercise:' || 'Supino declinado')::uuid, v_uid, 'Supino declinado', 'Peito'),
    (md5(v_uid::text || ':exercise:' || 'Peck deck')::uuid, v_uid, 'Peck deck', 'Peito'),
    (md5(v_uid::text || ':exercise:' || 'Encolhimento')::uuid, v_uid, 'Encolhimento', 'Trapézio'),
    (md5(v_uid::text || ':exercise:' || 'Rosca Scott')::uuid, v_uid, 'Rosca Scott', 'Bíceps'),
    (md5(v_uid::text || ':exercise:' || 'Tríceps testa')::uuid, v_uid, 'Tríceps testa', 'Tríceps'),
    (md5(v_uid::text || ':exercise:' || 'Agachamento búlgaro')::uuid, v_uid, 'Agachamento búlgaro', 'Quadríceps'),
    (md5(v_uid::text || ':exercise:' || 'Hip thrust máquina')::uuid, v_uid, 'Hip thrust máquina', 'Glúteos'),
    (md5(v_uid::text || ':exercise:' || 'Flexora em pé')::uuid, v_uid, 'Flexora em pé', 'Posterior de coxa'),
    (md5(v_uid::text || ':exercise:' || 'Sissy squat')::uuid, v_uid, 'Sissy squat', 'Quadríceps')
  on conflict do nothing;

  -- Rotinas (ids determinísticos: rodar de novo não duplica).
  insert into public.routines (id, user_id, name, position, notes, rest_sec) values
    (md5(v_uid::text || ':routine:' || 'Treino A')::uuid, v_uid, 'Treino A', 1, 'Rotina fictícia de exemplo.', 120),
    (md5(v_uid::text || ':routine:' || 'Treino B')::uuid, v_uid, 'Treino B', 2, 'Rotina fictícia de exemplo.', 120),
    (md5(v_uid::text || ':routine:' || 'Treino C')::uuid, v_uid, 'Treino C', 3, 'Rotina fictícia de exemplo.', 120),
    (md5(v_uid::text || ':routine:' || 'Treino D')::uuid, v_uid, 'Treino D', 4, 'Rotina fictícia de exemplo.', 120)
  on conflict (id) do nothing;

  insert into public.routine_exercises (id, user_id, routine_id, exercise_id, position, sets)
  select md5(v_uid::text || ':routine:' || r.routine || ':' || r.position)::uuid, v_uid,
         md5(v_uid::text || ':routine:' || r.routine)::uuid, e.id, r.position, r.sets
  from (values
    ('Treino A', 1, 3, 'Supino reto'),
    ('Treino A', 2, 3, 'Crucifixo máquina'),
    ('Treino A', 3, 3, 'Remada unilateral'),
    ('Treino A', 4, 3, 'Puxada neutra'),
    ('Treino A', 5, 3, 'Elevação frontal'),
    ('Treino A', 6, 3, 'Arnold press'),
    ('Treino A', 7, 3, 'Tríceps francês'),
    ('Treino A', 8, 3, 'Rosca martelo'),
    ('Treino B', 1, 4, 'Agachamento livre'),
    ('Treino B', 2, 3, 'Afundo'),
    ('Treino B', 3, 3, 'Cadeira adutora'),
    ('Treino B', 4, 4, 'Panturrilha no leg'),
    ('Treino B', 5, 3, 'Bom dia'),
    ('Treino B', 6, 3, 'Levantamento terra'),
    ('Treino C', 1, 3, 'Barra fixa'),
    ('Treino C', 2, 3, 'Remada máquina'),
    ('Treino C', 3, 3, 'Pullover'),
    ('Treino C', 4, 3, 'Supino declinado'),
    ('Treino C', 5, 3, 'Peck deck'),
    ('Treino C', 6, 3, 'Encolhimento'),
    ('Treino C', 7, 3, 'Rosca Scott'),
    ('Treino C', 8, 3, 'Tríceps testa'),
    ('Treino D', 1, 3, 'Agachamento búlgaro'),
    ('Treino D', 2, 3, 'Hip thrust máquina'),
    ('Treino D', 3, 3, 'Flexora em pé'),
    ('Treino D', 4, 3, 'Bom dia'),
    ('Treino D', 5, 3, 'Levantamento terra'),
    ('Treino D', 6, 3, 'Sissy squat')
  ) as r (routine, position, sets, exercise)
  join public.exercises e on e.user_id = v_uid and e.name = r.exercise
  on conflict (id) do nothing;

  -- Plano alimentar.
  insert into public.meals (id, user_id, name, time, position, training_day_only) values
    (md5(v_uid::text || ':meal:' || 'Ao acordar')::uuid, v_uid, 'Ao acordar', '07:00', 1, false),
    (md5(v_uid::text || ':meal:' || 'Café da manhã')::uuid, v_uid, 'Café da manhã', '08:30', 2, false),
    (md5(v_uid::text || ':meal:' || 'Almoço')::uuid, v_uid, 'Almoço', '12:30', 3, false),
    (md5(v_uid::text || ':meal:' || 'Lanche')::uuid, v_uid, 'Lanche', '16:00', 4, false),
    (md5(v_uid::text || ':meal:' || 'Pós-treino')::uuid, v_uid, 'Pós-treino', null, 5, true),
    (md5(v_uid::text || ':meal:' || 'Jantar')::uuid, v_uid, 'Jantar', '19:30', 6, false)
  on conflict (id) do nothing;

  insert into public.meal_options (id, user_id, meal_id, position, title, items) values
    (md5(v_uid::text || ':meal:' || 'Ao acordar' || ':option:' || 1)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Ao acordar')::uuid, 1, 'Hidratação',
     '[{"name":"Água","qty":"300 ml","subs":[]},{"name":"Café sem açúcar","qty":"1 xícara","subs":[]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Café da manhã' || ':option:' || 1)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Café da manhã')::uuid, 1, 'Tapioca',
     '[{"name":"Tapioca","qty":"40 g","subs":["Cuscuz 60 g"]},{"name":"Queijo branco","qty":"30 g","subs":[]},{"name":"Fruta da estação","qty":"1 un","subs":[]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Café da manhã' || ':option:' || 2)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Café da manhã')::uuid, 2, 'Iogurte',
     '[{"name":"Iogurte natural","qty":"170 g","subs":[]},{"name":"Granola","qty":"30 g","subs":["Aveia 30 g"]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Almoço' || ':option:' || 1)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Almoço')::uuid, 1, 'Prato feito',
     '[{"name":"Salada","qty":"à vontade","subs":[]},{"name":"Peixe","qty":"150 g","subs":["Ovos 3 un"]},{"name":"Arroz integral","qty":"150 g","subs":[]},{"name":"Lentilha","qty":"80 g","subs":[]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Almoço' || ':option:' || 2)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Almoço')::uuid, 2, 'Escondidinho',
     '[{"name":"Purê de mandioca","qty":"200 g","subs":[]},{"name":"Carne moída","qty":"120 g","subs":["Frango desfiado 130 g"]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Lanche' || ':option:' || 1)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Lanche')::uuid, 1, 'Sanduíche',
     '[{"name":"Pão integral","qty":"2 fatias","subs":[]},{"name":"Pasta de grão-de-bico","qty":"40 g","subs":[]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Pós-treino' || ':option:' || 1)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Pós-treino')::uuid, 1, 'Vitamina',
     '[{"name":"Leite","qty":"250 ml","subs":["Bebida vegetal 250 ml"]},{"name":"Fruta","qty":"1 un","subs":[]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Jantar' || ':option:' || 1)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Jantar')::uuid, 1, 'Omelete',
     '[{"name":"Ovos","qty":"3 un","subs":[]},{"name":"Legumes","qty":"à vontade","subs":[]},{"name":"Pão","qty":"1 fatia","subs":[]}]'::jsonb),
    (md5(v_uid::text || ':meal:' || 'Jantar' || ':option:' || 2)::uuid, v_uid,
     md5(v_uid::text || ':meal:' || 'Jantar')::uuid, 2, 'Sopa',
     '[{"name":"Sopa de legumes com frango","qty":"400 ml","subs":[]}]'::jsonb)
  on conflict (id) do nothing;

  -- Hábitos do sistema (o "Treino" é derivado de workouts e não fica aqui).
  insert into public.habits (user_id, name, kind, period, target, unit, system_key) values
    (v_uid, 'Cardio', 'cardio', 'week', 150, 'min', 'cardio'),
    (v_uid, 'Abdominal', 'check', 'week', 3, null, 'abs'),
    (v_uid, 'Desjejum/Suplementos', 'check', 'day', 1, null, 'supplements')
  on conflict (user_id, system_key) do nothing;
end
$$;
