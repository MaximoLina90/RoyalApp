-- Fotos y videos oficiales de productos, con verificación de variante
-- estado: verificada (pruebas automáticas suficientes), revisar (duda), aprobada (admin la confirmó), rechazada (admin la descartó)
create table if not exists public.producto_medios (
  id uuid primary key default gen_random_uuid(),
  producto_id integer not null references public.productos(id) on delete cascade,
  tipo text not null check (tipo in ('foto','video','youtube')),
  url text not null,                 -- archivo en el bucket 'productos' o, para youtube, el id del video
  fuente_url text,                   -- dirección original del archivo oficial
  pagina text,                       -- ficha oficial donde aparece
  archivo_original text,
  estado text not null default 'revisar' check (estado in ('verificada','revisar','aprobada','rechazada')),
  evidencia text,
  principal boolean not null default false,
  orden integer not null default 0,
  revisado_por uuid references auth.users(id) on delete set null,
  revisado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (producto_id, url)
);
create index if not exists producto_medios_prod on public.producto_medios(producto_id);

alter table public.producto_medios enable row level security;
grant select, insert, update, delete on public.producto_medios to authenticated;
drop policy if exists pm_ver on public.producto_medios;
create policy pm_ver on public.producto_medios for select to authenticated
  using (estado in ('verificada','aprobada') or public.es_admin());
drop policy if exists pm_admin on public.producto_medios;
create policy pm_admin on public.producto_medios for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- La foto principal de cada producto se toma de los medios visibles
create or replace function public.sync_imagen_producto(p integer) returns void
language sql security definer set search_path = public as $$
  update productos set imagen_url = (
    select m.url from producto_medios m
    where m.producto_id = p and m.tipo = 'foto' and m.estado in ('verificada','aprobada')
    order by m.principal desc, m.orden, m.created_at limit 1)
  where id = p;
$$;
create or replace function public.trg_sync_imagen() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform sync_imagen_producto(old.producto_id); end if;
  if tg_op in ('INSERT','UPDATE') then perform sync_imagen_producto(new.producto_id); end if;
  return null;
end $$;
drop trigger if exists producto_medios_sync on public.producto_medios;
create trigger producto_medios_sync after insert or update or delete on public.producto_medios
  for each row execute function public.trg_sync_imagen();

insert into storage.buckets (id, name, public, file_size_limit) values ('productos','productos', true, 52428800)
  on conflict (id) do update set public = true, file_size_limit = 52428800;
drop policy if exists "productos archivos lectura" on storage.objects;
create policy "productos archivos lectura" on storage.objects for select using (bucket_id = 'productos');
drop policy if exists "productos archivos admin" on storage.objects;
create policy "productos archivos admin" on storage.objects for all to authenticated
  using (bucket_id = 'productos' and public.es_admin()) with check (bucket_id = 'productos' and public.es_admin());
