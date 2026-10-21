-- =====================================================================
-- Seguridad anti cuentas compartidas
--  * Aprobación del admin para cuentas nuevas
--  * Máximo 2 dispositivos verificados por SMS (pueden usarse a la vez)
--  * Registro de accesos con alertas
-- El dispositivo se identifica con el header x-device-id que envía la app.
-- =====================================================================

alter table public.profiles add column if not exists aprobado boolean not null default false;
alter table public.profiles add column if not exists suspendido boolean not null default false;
alter table public.profiles add column if not exists max_dispositivos int not null default 2;
update public.profiles set aprobado = true where rol = 'admin';

create table if not exists public.dispositivos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  nombre text,
  verificado_at timestamptz,
  ultimo_acceso timestamptz not null default now(),
  revocado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (usuario_id, device_id)
);
alter table public.dispositivos enable row level security;
grant select, update, delete on public.dispositivos to authenticated;
drop policy if exists disp_ver on public.dispositivos;
create policy disp_ver on public.dispositivos for select to authenticated using (usuario_id = auth.uid() or public.es_admin());
drop policy if exists disp_admin on public.dispositivos;
create policy disp_admin on public.dispositivos for update to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists disp_borrar on public.dispositivos;
create policy disp_borrar on public.dispositivos for delete to authenticated using (public.es_admin());

create table if not exists public.accesos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  device_id text,
  dispositivo text,
  ip text,
  ciudad text,
  pais text,
  alerta text,
  created_at timestamptz not null default now()
);
create index if not exists accesos_usuario_idx on public.accesos(usuario_id, created_at desc);
alter table public.accesos enable row level security;
grant select on public.accesos to authenticated;
drop policy if exists acc_ver on public.accesos;
create policy acc_ver on public.accesos for select to authenticated using (usuario_id = auth.uid() or public.es_admin());

-- Header del dispositivo actual
create or replace function public.device_actual() returns text language sql stable as $$
  select nullif(coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-device-id', '');
$$;

-- ¿El usuario puede operar? (aprobado, no suspendido y en un dispositivo verificado)
create or replace function public.puede_operar() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from profiles p
    where p.id = auth.uid() and not p.suspendido and p.aprobado
      and (p.rol = 'admin' or exists(
        select 1 from dispositivos d
        where d.usuario_id = p.id and d.device_id = public.device_actual()
          and d.verificado_at is not null and not d.revocado)));
$$;
grant execute on function public.puede_operar(), public.device_actual() to authenticated;

-- Estado del dispositivo para la app
create or replace function public.estado_dispositivo() returns json
language plpgsql stable security definer set search_path = public as $$
declare p profiles; dev text := public.device_actual(); d dispositivos; usados int;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then return json_build_object('estado','sin_perfil'); end if;
  if p.suspendido then return json_build_object('estado','suspendido'); end if;
  if not p.aprobado then return json_build_object('estado','pendiente'); end if;
  if p.rol = 'admin' then return json_build_object('estado','ok'); end if;
  select * into d from dispositivos where usuario_id = p.id and device_id = dev;
  if d.id is not null and d.revocado then return json_build_object('estado','revocado'); end if;
  if d.id is not null and d.verificado_at is not null then return json_build_object('estado','ok'); end if;
  select count(*) into usados from dispositivos where usuario_id = p.id and verificado_at is not null and not revocado;
  if usados >= p.max_dispositivos then return json_build_object('estado','limite','max',p.max_dispositivos); end if;
  return json_build_object('estado','verificar','celular', case when p.celular is null then null else '••• ' || right(regexp_replace(p.celular,'\D','','g'),4) end);
end $$;
grant execute on function public.estado_dispositivo() to authenticated;

-- Los vendedores no pueden auto-aprobarse, cambiar su rol ni su celular (el celular recibe los códigos)
create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.es_admin() then return new; end if;
  if new.aprobado is distinct from old.aprobado or new.suspendido is distinct from old.suspendido
     or new.rol is distinct from old.rol or new.celular is distinct from old.celular
     or new.max_dispositivos is distinct from old.max_dispositivos then
    raise exception 'Solo un administrador puede cambiar esos datos';
  end if;
  return new;
end $$;
drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil before update on public.profiles for each row execute function public.proteger_perfil();

-- El alta de perfil ya no permite sobrescribir el celular
create or replace function public.registrar_perfil(p_keyword text, p_nombre text, p_celular text, p_codigo text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare h text; u uuid := auth.uid(); m text; primero boolean;
begin
  if u is null then raise exception 'No autenticado'; end if;
  if exists(select 1 from profiles where id = u) then return; end if;
  select keyword_hash into h from config where id = 1;
  if h is null or crypt(p_keyword, h) <> h then raise exception 'Palabra clave incorrecta'; end if;
  if coalesce(length(regexp_replace(p_celular,'\D','','g')),0) < 8 then raise exception 'Ingresá un celular válido'; end if;
  select email into m from auth.users where id = u;
  primero := not exists(select 1 from profiles where rol = 'admin');
  insert into profiles(id, nombre, email, celular, codigo_vendedor, rol, aprobado)
  values (u, p_nombre, m, p_celular, p_codigo, case when primero then 'admin' else 'vendedor' end, primero);
end $$;

-- Datos del negocio: solo usuarios habilitados en un dispositivo verificado
drop policy if exists prod_read on public.productos;
create policy prod_read on public.productos for select to authenticated using ((activo and public.puede_operar()) or public.es_admin());
drop policy if exists ped_own on public.pedidos;
create policy ped_own on public.pedidos for all to authenticated
  using ((usuario_id = auth.uid() and public.puede_operar()) or public.es_admin())
  with check (usuario_id = auth.uid() and public.puede_operar());
drop policy if exists tar_own on public.tareas;
create policy tar_own on public.tareas for all to authenticated
  using (usuario_id = auth.uid() and public.puede_operar()) with check (usuario_id = auth.uid() and public.puede_operar());
drop policy if exists "mk lectura" on public.marketplace_items;
create policy "mk lectura" on public.marketplace_items for select to authenticated
  using (public.puede_operar() and (activo or usuario_id = auth.uid() or public.es_admin()));
drop policy if exists "mk alta" on public.marketplace_items;
create policy "mk alta" on public.marketplace_items for insert to authenticated
  with check (usuario_id = auth.uid() and public.puede_operar());
