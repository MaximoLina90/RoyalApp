-- Links públicos para clientes: avisos de lectura, catálogo por producto, presupuesto por link, receta de la semana.

-- ---------- Avisos de lectura ----------
create table if not exists public.aperturas (
  id bigint generated always as identity primary key,
  vendedor uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('receta','producto','presupuesto')),
  ref text not null,
  titulo text,
  evento text not null check (evento in ('vista','whatsapp','lo_quiero')),
  created_at timestamptz not null default now()
);
create index if not exists aperturas_vend_idx on public.aperturas (vendedor, created_at desc);
alter table public.aperturas enable row level security;
revoke all on public.aperturas from anon, authenticated;

-- Lo llaman las páginas públicas (sin login). Solo registra si el vendedor existe y está aprobado.
-- Una misma vista se cuenta una sola vez cada 30 minutos.
create or replace function public.registrar_apertura(p_vendedor uuid, p_tipo text, p_ref text, p_evento text, p_titulo text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_vendedor is null or not exists(select 1 from profiles where id = p_vendedor and coalesce(aprobado,false)) then return; end if;
  if p_tipo not in ('receta','producto','presupuesto') or p_evento not in ('vista','whatsapp','lo_quiero') then return; end if;
  if exists(select 1 from aperturas where vendedor = p_vendedor and tipo = p_tipo and ref = left(p_ref,80) and evento = p_evento
            and created_at > now() - interval '30 minutes') then return; end if;
  insert into aperturas (vendedor, tipo, ref, titulo, evento) values (p_vendedor, p_tipo, left(p_ref,80), left(p_titulo,160), p_evento);
  if p_tipo = 'presupuesto' then
    update presupuestos set visto_at = coalesce(visto_at, now()),
      quiero_at = case when p_evento = 'lo_quiero' then coalesce(quiero_at, now()) else quiero_at end
    where id::text = p_ref;
  end if;
end $$;
revoke all on function public.registrar_apertura(uuid,text,text,text,text) from public;
grant execute on function public.registrar_apertura(uuid,text,text,text,text) to anon, authenticated;

-- Actividad visible: la propia y la de la red debajo (admin: todo).
create or replace function public.actividad_clientes(p_dias int default 30, p_solo_mia boolean default false)
returns table (id bigint, vendedor uuid, vendedor_nombre text, tipo text, ref text, titulo text, evento text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.vendedor, p.nombre, a.tipo, a.ref, a.titulo, a.evento, a.created_at
  from aperturas a join profiles p on p.id = a.vendedor
  where a.created_at > now() - make_interval(days => p_dias)
    and (a.vendedor = auth.uid() or (not p_solo_mia and public.usuario_debajo_mio(a.vendedor)))
  order by a.created_at desc limit 500;
$$;
grant execute on function public.actividad_clientes(int, boolean) to authenticated;

-- ---------- Presupuesto por link ----------
create table if not exists public.presupuestos (
  id uuid primary key default gen_random_uuid(),
  vendedor uuid not null references auth.users(id) on delete cascade default auth.uid(),
  cliente text,
  items jsonb not null,
  porcentaje int not null default 0,
  cuotas int not null default 1,
  factores jsonb not null,
  dias_mes int not null default 31,
  visto_at timestamptz,
  quiero_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.presupuestos enable row level security;
grant select, insert, delete on public.presupuestos to authenticated;
drop policy if exists pres_propios on public.presupuestos;
create policy pres_propios on public.presupuestos for all to authenticated
  using (vendedor = auth.uid() or public.usuario_debajo_mio(vendedor)) with check (vendedor = auth.uid());

create or replace function public.presupuesto_publico(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'presupuesto', json_build_object('id', q.id, 'cliente', q.cliente, 'items', q.items, 'porcentaje', q.porcentaje, 'cuotas', q.cuotas,
                                     'factores', q.factores, 'dias_mes', q.dias_mes, 'created_at', q.created_at),
    'vendedor', json_build_object('id', p.id, 'nombre', p.nombre, 'celular', p.celular))
  from presupuestos q join profiles p on p.id = q.vendedor
  where q.id = p_id and coalesce(p.aprobado,false) and not coalesce(p.suspendido,false)
    and q.created_at > now() - interval '120 days';
$$;
revoke all on function public.presupuesto_publico(uuid) from public;
grant execute on function public.presupuesto_publico(uuid) to anon, authenticated;

-- ---------- Catálogo público por producto ----------
create or replace function public.producto_publico(p_id int, p_vendedor uuid default null)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'producto', (select json_build_object('id', x.id, 'codigo', x.codigo, 'nombre', x.nombre, 'descripcion', x.descripcion, 'imagen_url', x.imagen_url,
                   'categoria', c.slug)
                 from productos x join categorias c on c.id = x.categoria_id where x.id = p_id and x.activo),
    'medios', coalesce((select json_agg(json_build_object('tipo', m.tipo, 'url', m.url) order by m.principal desc, m.orden)
                 from producto_medios m where m.producto_id = p_id and m.estado in ('verificada','aprobada')), '[]'::json),
    'vendedor', (select json_build_object('nombre', p.nombre, 'celular', p.celular) from profiles p
                 where p.id = p_vendedor and coalesce(p.aprobado,false) and not coalesce(p.suspendido,false))
  );
$$;
revoke all on function public.producto_publico(int, uuid) from public;
grant execute on function public.producto_publico(int, uuid) to anon, authenticated;

-- Recetas activas de un utensilio (para la ficha pública del producto)
create or replace function public.recetas_de_utensilio(p_utensilio text, p_limite int default 12)
returns table (slug text, titulo text, foto text, video boolean)
language sql stable security definer set search_path = public as $$
  select r.slug, r.titulo, r.fotos[1], r.video_url is not null from recetas r
  where r.activo and p_utensilio = any(r.utensilios)
  order by r.destacado desc, (r.video_url is not null) desc, cardinality(r.fotos) desc, r.titulo limit p_limite;
$$;
grant execute on function public.recetas_de_utensilio(text, int) to anon, authenticated;

-- ---------- Receta de la semana ----------
-- El admin puede fijar una receta para una semana (lunes). Si no hay, se elige sola entre las activas con foto.
alter table public.recetas add column if not exists semana date;
create or replace function public.receta_semana()
returns json language sql stable security definer set search_path = public as $$
  with lunes as (select date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires'))::date d),
  fija as (select r.* from recetas r, lunes where r.activo and r.semana = lunes.d limit 1),
  pool as (select r.*, row_number() over (order by md5(r.slug)) - 1 n, count(*) over () t
           from recetas r where r.activo and cardinality(r.fotos) > 0 and not r.solo_otro_royal),
  auto as (select pool.* from pool, lunes where pool.n = ((lunes.d - date '2026-01-05') / 7) % pool.t)
  select to_jsonb(x) - 'activo' - 'solo_otro_royal' - 'n' - 't' from (
    select slug, titulo, descripcion, fotos, video_url, tiempo_min, porciones, utensilios, activo, solo_otro_royal, 0 n, 0 t from fija
    union all
    select slug, titulo, descripcion, fotos, video_url, tiempo_min, porciones, utensilios, activo, solo_otro_royal, n, t from auto
    limit 1) x;
$$;
grant execute on function public.receta_semana() to anon, authenticated;
