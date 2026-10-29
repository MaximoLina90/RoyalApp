-- Popularidad de recetas: aperturas de clientes por link (vista = 1, clic a WhatsApp = 3), todos los vendedores.
create index if not exists aperturas_tipo_ref_idx on public.aperturas (tipo, ref);
create or replace function public.popularidad_recetas()
returns table (slug text, puntos int)
language sql stable security definer set search_path = public as $$
  select ref, (count(*) filter (where evento = 'vista') + 3 * count(*) filter (where evento = 'whatsapp'))::int
  from aperturas where tipo = 'receta' group by ref;
$$;
revoke all on function public.popularidad_recetas() from public, anon;
grant execute on function public.popularidad_recetas() to authenticated;
