-- =====================================================================
-- Objetivos gamificados y registro de actividades
-- =====================================================================
-- Las actividades se toman de la Agenda (tareas) y de los videos vistos en Capacitación.
drop table if exists public.actividades;
alter table public.tareas drop constraint if exists tareas_evento_check;
alter table public.tareas add constraint tareas_evento_check check (evento in ('Demo','Entrevista','Capacitación','Servicio','Extracurricular','Otro'));

-- Capacitación interna: videos y registro de vistos
create table if not exists public.capacitacion_videos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  url text not null,
  categoria text,
  orden int not null default 0,
  activo boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.capacitacion_videos enable row level security;
grant select, insert, update, delete on public.capacitacion_videos to authenticated;
drop policy if exists vid_ver on public.capacitacion_videos;
create policy vid_ver on public.capacitacion_videos for select to authenticated using (public.puede_operar() and (activo or public.es_admin()));
drop policy if exists vid_admin on public.capacitacion_videos;
create policy vid_admin on public.capacitacion_videos for all to authenticated using (public.es_admin()) with check (public.es_admin());

create table if not exists public.videos_vistos (
  usuario_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  video_id uuid not null references public.capacitacion_videos(id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (usuario_id, video_id)
);
alter table public.videos_vistos enable row level security;
grant select, insert on public.videos_vistos to authenticated;
drop policy if exists vv_ver on public.videos_vistos;
create policy vv_ver on public.videos_vistos for select to authenticated using (public.usuario_en_mi_red(usuario_id));
drop policy if exists vv_alta on public.videos_vistos;
create policy vv_alta on public.videos_vistos for insert to authenticated with check (usuario_id = auth.uid() and public.puede_operar());

create table if not exists public.objetivos (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid references public.profiles(id) on delete set null default auth.uid(),
  alcance text not null references public.nodos(codigo) on update cascade on delete cascade,
  titulo text not null,
  modo text not null check (modo in ('meta','competencia')),
  tipos text[] not null,
  metrica text not null default 'cantidad' check (metrica in ('cantidad','mayor')),
  cantidad int check (cantidad is null or cantidad > 0),
  premio numeric not null default 0,
  desde date not null default date_trunc('month', current_date)::date,
  hasta date not null default (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  created_at timestamptz not null default now(),
  check (hasta >= desde)
);
alter table public.objetivos enable row level security;
grant select, insert, update, delete on public.objetivos to authenticated;

-- ¿Pertenezco a la rama del alcance (para ver el objetivo)?
create or replace function public.en_rama_de(p_codigo text) returns boolean language sql stable security definer set search_path = public as $$
  select public.mi_codigo() in (select public.subarbol(p_codigo));
$$;
grant execute on function public.en_rama_de(text) to authenticated;

drop policy if exists obj_ver on public.objetivos;
create policy obj_ver on public.objetivos for select to authenticated using (public.puede_operar() and (public.en_mi_red(alcance) or public.en_rama_de(alcance)));
drop policy if exists obj_alta on public.objetivos;
create policy obj_alta on public.objetivos for insert to authenticated with check (public.en_mi_red(alcance) and (public.es_admin() or exists(select 1 from nodos where superior = public.mi_codigo())));
drop policy if exists obj_mod on public.objetivos;
create policy obj_mod on public.objetivos for update to authenticated using (public.en_mi_red(alcance)) with check (public.en_mi_red(alcance));
drop policy if exists obj_borrar on public.objetivos;
create policy obj_borrar on public.objetivos for delete to authenticated using (public.en_mi_red(alcance) and (creado_por = auth.uid() or public.es_admin() or public.debajo_mio(alcance)));

-- Tabla de posiciones de un objetivo (todos los integrantes activos de la rama del alcance)
create or replace function public.tabla_objetivo(p_id uuid)
returns table(usuario_id uuid, nombre text, codigo text, valor numeric)
language plpgsql stable security definer set search_path = public as $$
declare o objetivos;
begin
  select * into o from objetivos where id = p_id;
  if o.id is null or not (public.en_mi_red(o.alcance) or public.en_rama_de(o.alcance)) then raise exception 'Objetivo no disponible'; end if;
  return query
  select p.id, p.nombre, p.codigo_vendedor,
    case when o.metrica = 'mayor' then
      coalesce((select max(pe.total) from pedidos pe where pe.usuario_id = p.id and pe.created_at::date between o.desde and o.hasta), 0)::numeric
    else
      (case when 'venta' = any(o.tipos) then (select count(*) from pedidos pe where pe.usuario_id = p.id and pe.created_at::date between o.desde and o.hasta) else 0 end
       + (select count(*) from tareas t where t.usuario_id = p.id and t.fecha between o.desde and least(o.hasta, current_date)
           and ((t.evento = 'Demo' and 'demo' = any(o.tipos)) or (t.evento = 'Entrevista' and 'entrevista' = any(o.tipos))
             or (t.evento = 'Servicio' and 'servicio' = any(o.tipos)) or (t.evento = 'Capacitación' and 'capacitacion' = any(o.tipos))
             or (t.evento = 'Extracurricular' and 'extracurricular' = any(o.tipos))))
       + (case when 'video' = any(o.tipos) then (select count(*) from videos_vistos v where v.usuario_id = p.id and v.visto_at::date between o.desde and o.hasta) else 0 end))::numeric
    end as valor
  from profiles p
  where p.codigo_vendedor in (select public.subarbol(o.alcance)) and p.aprobado and not p.suspendido
  order by valor desc, p.nombre;
end $$;
grant execute on function public.tabla_objetivo(uuid) to authenticated;
