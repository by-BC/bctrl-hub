-- O Supabase cria public.rls_auto_enable() (event trigger que liga RLS em tabelas
-- novas) como SECURITY DEFINER com EXECUTE para anon/authenticated, exposta em
-- /rest/v1/rpc. Ela só deve rodar como trigger: revoga a execução pela API.
-- Condicional: a função existe no projeto remoto, mas não no Supabase local.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end
$$;
