-- Marketplace: publicaciones de los vendedores del equipo
create table if not exists public.marketplace_items (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 2 and 120),
  descripcion text,
  categoria text not null default 'Otro',
  estado text not null default 'Nuevo' check (estado in ('Nuevo','Usado','Reacondicionado')),
  precio numeric(14,2) not null default 0 check (precio >= 0),
  imagen_url text,
  contacto text,
  ubicacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists marketplace_items_created_idx on public.marketplace_items(created_at desc);
alter table public.marketplace_items enable row level security;
grant select, insert, update, delete on public.marketplace_items to authenticated;

drop policy if exists "mk lectura" on public.marketplace_items;
create policy "mk lectura" on public.marketplace_items for select to authenticated
  using (activo or usuario_id = auth.uid() or public.es_admin());
drop policy if exists "mk alta" on public.marketplace_items;
create policy "mk alta" on public.marketplace_items for insert to authenticated
  with check (usuario_id = auth.uid());
drop policy if exists "mk edicion" on public.marketplace_items;
create policy "mk edicion" on public.marketplace_items for update to authenticated
  using (usuario_id = auth.uid() or public.es_admin()) with check (usuario_id = auth.uid() or public.es_admin());
drop policy if exists "mk baja" on public.marketplace_items;
create policy "mk baja" on public.marketplace_items for delete to authenticated
  using (usuario_id = auth.uid() or public.es_admin());

-- Fotos: cada usuario sube en su carpeta <uid>/...
insert into storage.buckets (id, name, public) values ('marketplace','marketplace', true) on conflict (id) do nothing;
drop policy if exists "mk fotos lectura" on storage.objects;
create policy "mk fotos lectura" on storage.objects for select using (bucket_id = 'marketplace');
drop policy if exists "mk fotos propias" on storage.objects;
create policy "mk fotos propias" on storage.objects for all to authenticated
  using (bucket_id = 'marketplace' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()))
  with check (bucket_id = 'marketplace' and (storage.foldername(name))[1] = auth.uid()::text);

-- Nombre del vendedor visible para el resto (profiles es privado)
alter table public.marketplace_items add column if not exists vendedor_nombre text;
create or replace function public.mk_set_vendedor() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then new.usuario_id := auth.uid(); end if;
  select nombre into new.vendedor_nombre from profiles where id = new.usuario_id;
  return new;
end $$;
drop trigger if exists mk_vendedor on public.marketplace_items;
create trigger mk_vendedor before insert or update on public.marketplace_items for each row execute function public.mk_set_vendedor();

-- 2026-10-21: solo el administrador publica
drop policy if exists "mk alta" on public.marketplace_items;
create policy "mk alta" on public.marketplace_items for insert to authenticated with check (usuario_id = auth.uid() and public.es_admin());
drop policy if exists "mk edicion" on public.marketplace_items;
create policy "mk edicion" on public.marketplace_items for update to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "mk baja" on public.marketplace_items;
create policy "mk baja" on public.marketplace_items for delete to authenticated using (public.es_admin());
drop policy if exists "mk fotos propias" on storage.objects;
create policy "mk fotos propias" on storage.objects for all to authenticated
  using (bucket_id = 'marketplace' and public.es_admin()) with check (bucket_id = 'marketplace' and public.es_admin());
