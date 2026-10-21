-- =====================================================================
-- Estructura piramidal de equipos
-- nodos: cada código de vendedor/líder con su superior. Mover un nodo mueve toda su rama.
-- Los líderes cargan los códigos de sus dependientes; el vendedor se registra con su código.
-- =====================================================================

create table if not exists public.nodos (
  codigo text primary key check (char_length(trim(codigo)) between 1 and 40),
  nombre text not null,
  superior text references public.nodos(codigo) on update cascade on delete restrict,
  equipo_numero text,
  equipo_nombre text,
  activo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists nodos_superior_idx on public.nodos(superior);

alter table public.profiles add column if not exists telefono_verificado boolean not null default false;

-- Nodo raíz para el/los admin existentes
insert into public.nodos(codigo, nombre, equipo_nombre)
select 'DIR', p.nombre, 'Dirección' from public.profiles p where p.rol = 'admin' order by p.created_at limit 1
on conflict do nothing;
update public.profiles set codigo_vendedor = 'DIR', telefono_verificado = true where rol = 'admin' and id = (select id from public.profiles where rol='admin' order by created_at limit 1);
update public.profiles set codigo_vendedor = null where codigo_vendedor is not null and codigo_vendedor not in (select codigo from public.nodos);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_codigo_fk') then
    alter table public.profiles add constraint profiles_codigo_fk foreign key (codigo_vendedor) references public.nodos(codigo) on update cascade on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_codigo_unico') then
    alter table public.profiles add constraint profiles_codigo_unico unique (codigo_vendedor);
  end if;
end $$;

-- ---------- helpers ----------
create or replace function public.mi_codigo() returns text language sql stable security definer set search_path = public as $$
  select codigo_vendedor from profiles where id = auth.uid();
$$;

create or replace function public.subarbol(p_codigo text) returns setof text language sql stable security definer set search_path = public as $$
  with recursive r(c) as (select p_codigo union select n.codigo from nodos n join r on n.superior = r.c)
  select c from r where c is not null;
$$;

-- ¿El código está en mi red (yo incluido)?
create or replace function public.en_mi_red(p_codigo text) returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or (p_codigo is not null and p_codigo in (select public.subarbol(public.mi_codigo())));
$$;
-- ¿El código está debajo mío (sin incluirme)?
create or replace function public.debajo_mio(p_codigo text) returns boolean language sql stable security definer set search_path = public as $$
  select p_codigo is distinct from public.mi_codigo() and public.en_mi_red(p_codigo);
$$;
create or replace function public.usuario_en_mi_red(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_uid = auth.uid() or public.es_admin() or exists(select 1 from profiles where id = p_uid and public.en_mi_red(codigo_vendedor));
$$;
create or replace function public.usuario_debajo_mio(p_uid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_uid <> auth.uid() and (public.es_admin() or exists(select 1 from profiles where id = p_uid and public.debajo_mio(codigo_vendedor)));
$$;
grant execute on function public.mi_codigo(), public.subarbol(text), public.en_mi_red(text), public.debajo_mio(text), public.usuario_en_mi_red(uuid), public.usuario_debajo_mio(uuid) to authenticated;

-- ---------- nodos: RLS ----------
alter table public.nodos enable row level security;
grant select, insert, update, delete on public.nodos to authenticated;
drop policy if exists nodos_ver on public.nodos;
create or replace function public.mi_superior() returns text language sql stable security definer set search_path = public as $$
  select superior from nodos where codigo = public.mi_codigo();
$$;
grant execute on function public.mi_superior() to authenticated;
create policy nodos_ver on public.nodos for select to authenticated using (public.en_mi_red(codigo) or codigo = public.mi_superior());
drop policy if exists nodos_alta on public.nodos;
create policy nodos_alta on public.nodos for insert to authenticated with check (superior is not null and public.en_mi_red(superior));
drop policy if exists nodos_editar on public.nodos;
create policy nodos_editar on public.nodos for update to authenticated using (public.en_mi_red(codigo)) with check (public.en_mi_red(codigo));
drop policy if exists nodos_borrar on public.nodos;
create policy nodos_borrar on public.nodos for delete to authenticated using (public.debajo_mio(codigo));

-- Validaciones al mover/editar: sin ciclos, el nuevo superior debe estar en mi red, nadie se mueve a sí mismo
create or replace function public.validar_nodo() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.codigo := upper(trim(new.codigo));
  if tg_op = 'UPDATE' and new.superior is distinct from old.superior then
    if new.superior is null and not public.es_admin() then raise exception 'Solo el administrador puede crear jefes sin superior'; end if;
    if not public.es_admin() and old.codigo = public.mi_codigo() then raise exception 'No podés cambiar tu propio superior'; end if;
    if new.superior is not null and not public.en_mi_red(new.superior) then raise exception 'El nuevo superior no pertenece a tu red'; end if;
    if new.superior in (select public.subarbol(old.codigo)) then raise exception 'No se puede asignar como superior a alguien de su propia rama'; end if;
  end if;
  if tg_op = 'UPDATE' and new.codigo is distinct from old.codigo and not public.es_admin() then raise exception 'Solo el administrador puede cambiar un código'; end if;
  return new;
end $$;
drop trigger if exists validar_nodo on public.nodos;
create trigger validar_nodo before insert or update on public.nodos for each row execute function public.validar_nodo();

-- Carga masiva: líneas "codigo;nombre" (o con coma/tab) bajo un superior
create or replace function public.cargar_codigos(p_superior text, p_lineas text) returns json
language plpgsql security definer set search_path = public as $$
declare l text; partes text[]; c text; n text; ok int := 0; dup text[] := '{}';
begin
  if not public.en_mi_red(p_superior) then raise exception 'El superior no pertenece a tu red'; end if;
  foreach l in array regexp_split_to_array(coalesce(p_lineas,''), E'\\n') loop
    l := trim(l); if l = '' then continue; end if;
    partes := regexp_split_to_array(l, E'\\s*[;,\\t]\\s*');
    c := upper(trim(partes[1])); n := trim(coalesce(partes[2], ''));
    if c = '' or n = '' then continue; end if;
    if exists(select 1 from nodos where codigo = c) then dup := dup || c; continue; end if;
    insert into nodos(codigo, nombre, superior, created_by) values (c, n, p_superior, auth.uid());
    ok := ok + 1;
  end loop;
  return json_build_object('cargados', ok, 'existentes', dup);
end $$;
grant execute on function public.cargar_codigos(text, text) to authenticated;

-- Validación pública del código al registrarse
create or replace function public.validar_codigo(p_codigo text) returns json
language sql stable security definer set search_path = public as $$
  select case
    when n.codigo is null then json_build_object('ok', false, 'error', 'El código no existe. Pedíselo a tu líder.')
    when not n.activo then json_build_object('ok', false, 'error', 'El código está deshabilitado. Consultá con tu líder.')
    when exists(select 1 from profiles where codigo_vendedor = n.codigo) then json_build_object('ok', false, 'error', 'Ese código ya tiene una cuenta registrada.')
    else json_build_object('ok', true, 'nombre', n.nombre) end
  from (select 1) x left join nodos n on n.codigo = upper(trim(p_codigo));
$$;
grant execute on function public.validar_codigo(text) to anon, authenticated;

-- Alta de perfil con código (sin palabra clave)
drop function if exists public.registrar_perfil(text, text, text, text);
create or replace function public.registrar_perfil(p_codigo text, p_celular text)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); m text; n nodos; v json;
begin
  if u is null then raise exception 'No autenticado'; end if;
  if exists(select 1 from profiles where id = u) then return; end if;
  v := public.validar_codigo(p_codigo);
  if not (v->>'ok')::boolean then raise exception '%', v->>'error'; end if;
  if coalesce(length(regexp_replace(p_celular,'\D','','g')),0) < 8 then raise exception 'Ingresá un celular válido'; end if;
  select * into n from nodos where codigo = upper(trim(p_codigo));
  select email into m from auth.users where id = u;
  insert into profiles(id, nombre, email, celular, codigo_vendedor, rol, aprobado)
  values (u, n.nombre, m, p_celular, n.codigo, 'vendedor', false);
end $$;
grant execute on function public.registrar_perfil(text, text) to authenticated;

-- ---------- perfiles y datos visibles por la red ----------
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.usuario_en_mi_red(id));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.usuario_debajo_mio(id)) with check (id = auth.uid() or public.usuario_debajo_mio(id));

create or replace function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.es_admin() then return new; end if;
  if new.rol is distinct from old.rol or new.codigo_vendedor is distinct from old.codigo_vendedor
     or new.telefono_verificado is distinct from old.telefono_verificado then
    raise exception 'Solo el administrador puede cambiar esos datos';
  end if;
  if old.id = auth.uid() and (new.aprobado is distinct from old.aprobado or new.suspendido is distinct from old.suspendido
     or new.celular is distinct from old.celular or new.max_dispositivos is distinct from old.max_dispositivos) then
    raise exception 'No podés cambiar esos datos de tu propia cuenta';
  end if;
  if new.celular is distinct from old.celular then new.telefono_verificado := false; end if;
  return new;
end $$;

create or replace function public.estado_dispositivo() returns json
language plpgsql stable security definer set search_path = public as $$
declare p profiles; dev text := public.device_actual(); d dispositivos; usados int;
  mask text;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then return json_build_object('estado','sin_perfil'); end if;
  mask := case when p.celular is null then null else '••• ' || right(regexp_replace(p.celular,'\D','','g'),4) end;
  if p.suspendido then return json_build_object('estado','suspendido'); end if;
  if not p.telefono_verificado then return json_build_object('estado','verificar_telefono','celular',mask); end if;
  if not p.aprobado then return json_build_object('estado','pendiente'); end if;
  if p.rol = 'admin' then return json_build_object('estado','ok'); end if;
  select * into d from dispositivos where usuario_id = p.id and device_id = dev;
  if d.id is not null and d.revocado then return json_build_object('estado','revocado'); end if;
  if d.id is not null and d.verificado_at is not null then return json_build_object('estado','ok'); end if;
  select count(*) into usados from dispositivos where usuario_id = p.id and verificado_at is not null and not revocado;
  if usados >= p.max_dispositivos then return json_build_object('estado','limite','max',p.max_dispositivos); end if;
  return json_build_object('estado','verificar','celular',mask);
end $$;

drop policy if exists disp_ver on public.dispositivos;
create policy disp_ver on public.dispositivos for select to authenticated using (public.usuario_en_mi_red(usuario_id));
drop policy if exists disp_admin on public.dispositivos;
create policy disp_admin on public.dispositivos for update to authenticated using (public.usuario_debajo_mio(usuario_id)) with check (public.usuario_debajo_mio(usuario_id));
drop policy if exists disp_borrar on public.dispositivos;
create policy disp_borrar on public.dispositivos for delete to authenticated using (public.usuario_debajo_mio(usuario_id));
drop policy if exists acc_ver on public.accesos;
create policy acc_ver on public.accesos for select to authenticated using (public.usuario_en_mi_red(usuario_id));

-- Pedidos: propios para operar; lectura de toda la red para métricas
drop policy if exists ped_own on public.pedidos;
drop policy if exists ped_ver on public.pedidos;
create policy ped_ver on public.pedidos for select to authenticated using (public.puede_operar() and public.usuario_en_mi_red(usuario_id));
drop policy if exists ped_alta on public.pedidos;
create policy ped_alta on public.pedidos for insert to authenticated with check (usuario_id = auth.uid() and public.puede_operar());
drop policy if exists ped_mod on public.pedidos;
create policy ped_mod on public.pedidos for update to authenticated using (usuario_id = auth.uid() and public.puede_operar()) with check (usuario_id = auth.uid());
drop policy if exists ped_borrar on public.pedidos;
create policy ped_borrar on public.pedidos for delete to authenticated using ((usuario_id = auth.uid() and public.puede_operar()) or public.es_admin());

-- Métricas: pedidos de mi red con datos del vendedor y su equipo (líder directo)
create or replace view public.ventas_red with (security_invoker = true) as
select pe.id, pe.usuario_id, pe.numero, pe.total, pe.pago, pe.cuotas, pe.created_at,
       pr.nombre as vendedor_nombre, pr.codigo_vendedor as vendedor_codigo,
       n.superior as lider_codigo, l.nombre as lider_nombre, l.equipo_numero, l.equipo_nombre
from public.pedidos pe
join public.profiles pr on pr.id = pe.usuario_id
left join public.nodos n on n.codigo = pr.codigo_vendedor
left join public.nodos l on l.codigo = n.superior;
grant select on public.ventas_red to authenticated;

-- La palabra clave ya no se usa
drop function if exists public.cambiar_keyword(text);
alter table public.config alter column keyword_hash drop not null;
