create table public.finance_category_preferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.finance_categories (id) on delete cascade,
  color text not null default '#64748b' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_active boolean not null default true,
  primary key (user_id, category_id)
);

alter table public.finance_category_preferences enable row level security;
revoke all on table public.finance_category_preferences from anon, public;
grant select, insert, update, delete on table public.finance_category_preferences to authenticated;
grant all on table public.finance_category_preferences to service_role;

create policy "usuário gerencia preferências das próprias categorias"
  on public.finance_category_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.finance_categories c
      where c.id = category_id and (c.user_id is null or c.user_id = (select auth.uid()))
    )
  );
