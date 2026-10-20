-- Royal App · esquema Supabase
create extension if not exists pgcrypto;

create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  keyword_hash text not null,
  factores jsonb not null default '{"3":0.36,"6":0.19,"9":0.135,"12":0.105,"14":0.093,"18":0.075}',
  dias_mes int not null default 31,
  updated_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  celular text,
  codigo_vendedor text,
  rol text not null default 'vendedor' check (rol in ('vendedor','admin')),
  created_at timestamptz default now()
);

create table if not exists public.categorias (
  id serial primary key,
  slug text unique not null,
  nombre text not null,
  descripcion text,
  orden int not null default 0
);

create table if not exists public.productos (
  id serial primary key,
  categoria_id int not null references public.categorias(id) on delete restrict,
  codigo text,
  nombre text not null,
  descripcion text,
  precio bigint not null default 0,
  imagen_url text,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  numero int not null,
  cliente text,
  total bigint not null,
  entrega bigint not null default 0,
  porcentaje_entrega int not null default 0,
  cuotas int not null default 1,
  cuota bigint not null default 0,
  pago text not null check (pago in ('Contado','Financiado')),
  items jsonb not null default '[]',
  created_at timestamptz default now(),
  unique (usuario_id, numero)
);

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  fecha date not null,
  horario time,
  evento text not null check (evento in ('Demo','Entrevista','Capacitación','Servicio','Otro')),
  titulo text not null,
  ubicacion text,
  notas text,
  created_at timestamptz default now()
);
create index if not exists tareas_usuario_fecha on public.tareas(usuario_id, fecha);
create index if not exists pedidos_usuario_fecha on public.pedidos(usuario_id, created_at desc);

-- helpers
create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and rol = 'admin');
$$;

-- Alta de perfil validando la palabra clave del equipo (reemplaza el chequeo inseguro de la app Android)
create or replace function public.registrar_perfil(p_keyword text, p_nombre text, p_celular text, p_codigo text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare h text; u uuid := auth.uid(); m text;
begin
  if u is null then raise exception 'No autenticado'; end if;
  select keyword_hash into h from config where id = 1;
  if h is null or crypt(p_keyword, h) <> h then raise exception 'Palabra clave incorrecta'; end if;
  select email into m from auth.users where id = u;
  insert into profiles(id, nombre, email, celular, codigo_vendedor)
  values (u, p_nombre, m, p_celular, p_codigo)
  on conflict (id) do update set nombre = excluded.nombre, celular = excluded.celular, codigo_vendedor = excluded.codigo_vendedor;
end $$;

create or replace function public.cambiar_keyword(p_nueva text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not es_admin() then raise exception 'Solo administradores'; end if;
  update config set keyword_hash = crypt(p_nueva, gen_salt('bf')), updated_at = now() where id = 1;
end $$;

-- número de pedido correlativo por vendedor
create or replace function public.set_numero_pedido() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(max(numero),0)+1 into new.numero from pedidos where usuario_id = new.usuario_id;
  return new;
end $$;
drop trigger if exists trg_numero_pedido on public.pedidos;
create trigger trg_numero_pedido before insert on public.pedidos for each row execute function public.set_numero_pedido();

-- vista pública de config (sin hash)
create or replace view public.config_publica with (security_invoker = false) as
  select factores, dias_mes from public.config where id = 1;

-- RLS
alter table public.config enable row level security;
alter table public.profiles enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.pedidos enable row level security;
alter table public.tareas enable row level security;

drop policy if exists config_admin on public.config;
create policy config_admin on public.config for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or es_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid() or es_admin())
  with check (es_admin() or (id = auth.uid() and rol = (select rol from profiles p where p.id = auth.uid())));

drop policy if exists cat_read on public.categorias;
create policy cat_read on public.categorias for select to authenticated using (true);
drop policy if exists cat_admin on public.categorias;
create policy cat_admin on public.categorias for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists prod_read on public.productos;
create policy prod_read on public.productos for select to authenticated using (activo or es_admin());
drop policy if exists prod_admin on public.productos;
create policy prod_admin on public.productos for all to authenticated using (es_admin()) with check (es_admin());

drop policy if exists ped_own on public.pedidos;
create policy ped_own on public.pedidos for all to authenticated
  using (usuario_id = auth.uid() or es_admin()) with check (usuario_id = auth.uid());

drop policy if exists tar_own on public.tareas;
create policy tar_own on public.tareas for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.config_publica to authenticated;
grant select, insert, update, delete on public.profiles, public.categorias, public.productos, public.pedidos, public.tareas to authenticated;
grant select, update on public.config to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.registrar_perfil(text,text,text,text), public.cambiar_keyword(text), public.es_admin() to authenticated;

-- Storage para fotos de productos
insert into storage.buckets (id, name, public) values ('productos','productos', true) on conflict (id) do nothing;
drop policy if exists "productos lectura" on storage.objects;
create policy "productos lectura" on storage.objects for select using (bucket_id = 'productos');
drop policy if exists "productos admin" on storage.objects;
create policy "productos admin" on storage.objects for all to authenticated
  using (bucket_id = 'productos' and public.es_admin()) with check (bucket_id = 'productos' and public.es_admin());
