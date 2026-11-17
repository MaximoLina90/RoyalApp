-- Recuperar contraseña por SMS: el servidor (service_role) busca la cuenta por email.
create or replace function public.cuenta_por_email(p_email text)
returns table (id uuid, celular text, suspendido boolean)
language sql stable security definer set search_path = public, auth as $$
  select u.id, p.celular, coalesce(p.suspendido,false) from auth.users u join profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.cuenta_por_email(text) from public, anon, authenticated;
grant execute on function public.cuenta_por_email(text) to service_role;
