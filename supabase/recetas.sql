-- Recetas Royal: recetas de fuentes oficiales y extraoficiales, con fotos/videos descargados o YouTube embebido
create table if not exists public.recetas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  descripcion text,
  porciones text,
  tiempo_min int,
  dificultad text check (dificultad in ('facil','media','dificil')),
  ingredientes jsonb not null default '[]'::jsonb,
  pasos jsonb not null default '[]'::jsonb,
  tips text,
  categorias text[] not null default '{}',
  utensilios text[] not null default '{}',
  fotos text[] not null default '{}',
  video_tipo text check (video_tipo in ('mp4','youtube')),
  video_url text,
  fuente_nombre text,
  fuente_url text,
  fuente_tipo text not null default 'oficial' check (fuente_tipo in ('oficial','extraoficial')),
  pais text,
  traducida boolean not null default false,
  destacado boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists recetas_cat_idx on public.recetas using gin (categorias);
create index if not exists recetas_ut_idx on public.recetas using gin (utensilios);
alter table public.recetas enable row level security;
grant select, insert, update, delete on public.recetas to authenticated;
drop policy if exists rec_ver on public.recetas;
create policy rec_ver on public.recetas for select to authenticated using (activo or public.es_admin());
drop policy if exists rec_admin on public.recetas;
create policy rec_admin on public.recetas for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Favoritas de cada usuario
create table if not exists public.recetas_favoritas (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  receta_id uuid not null references public.recetas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, receta_id)
);
alter table public.recetas_favoritas enable row level security;
grant select, insert, delete on public.recetas_favoritas to authenticated;
drop policy if exists recfav_propias on public.recetas_favoritas;
create policy recfav_propias on public.recetas_favoritas for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit) values ('recetas','recetas', true, 52428800)
  on conflict (id) do update set file_size_limit = 52428800;
drop policy if exists "recetas archivos lectura" on storage.objects;
create policy "recetas archivos lectura" on storage.objects for select using (bucket_id = 'recetas');
drop policy if exists "recetas archivos admin" on storage.objects;
create policy "recetas archivos admin" on storage.objects for all to authenticated
  using (bucket_id = 'recetas' and public.es_admin()) with check (bucket_id = 'recetas' and public.es_admin());

-- Productos Royal que usa la receta (texto de la ficha) y si solo usa productos que no se venden en Argentina
alter table public.recetas add column if not exists productos_royal text[] not null default '{}';
alter table public.recetas add column if not exists solo_otro_royal boolean not null default false;
