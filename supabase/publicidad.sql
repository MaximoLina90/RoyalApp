-- Publicidad: material que sube el administrador para que los vendedores distribuyan
create table if not exists public.publicidad (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  categoria text not null default 'Promociones',
  tipo text not null default 'imagen' check (tipo in ('imagen','video','pdf','texto')),
  archivo_url text,
  texto text,
  destacado boolean not null default false,
  activo boolean not null default true,
  vence date,
  created_at timestamptz not null default now()
);
alter table public.publicidad enable row level security;
grant select, insert, update, delete on public.publicidad to authenticated;
drop policy if exists pub_ver on public.publicidad;
create policy pub_ver on public.publicidad for select to authenticated using (activo or public.es_admin());
drop policy if exists pub_admin on public.publicidad;
create policy pub_admin on public.publicidad for all to authenticated using (public.es_admin()) with check (public.es_admin());

insert into storage.buckets (id, name, public, file_size_limit) values ('publicidad','publicidad', true, 52428800)
  on conflict (id) do update set file_size_limit = 52428800;
drop policy if exists "pub archivos lectura" on storage.objects;
create policy "pub archivos lectura" on storage.objects for select using (bucket_id = 'publicidad');
drop policy if exists "pub archivos admin" on storage.objects;
create policy "pub archivos admin" on storage.objects for all to authenticated
  using (bucket_id = 'publicidad' and public.es_admin()) with check (bucket_id = 'publicidad' and public.es_admin());
