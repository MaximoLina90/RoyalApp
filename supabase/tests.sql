-- Tests de lecturas (y cualquier material): banco de preguntas, corrección del lado del servidor
create table if not exists public.capacitacion_preguntas (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.capacitacion_videos(id) on delete cascade,
  orden int not null default 0,
  capitulo text,
  pregunta text not null,
  opciones jsonb not null,
  correcta int not null,
  explicacion text,
  created_at timestamptz not null default now()
);
alter table public.capacitacion_preguntas enable row level security;
grant select, insert, update, delete on public.capacitacion_preguntas to authenticated;
drop policy if exists cpr_admin on public.capacitacion_preguntas;
create policy cpr_admin on public.capacitacion_preguntas for all to authenticated using (public.es_admin()) with check (public.es_admin());

create table if not exists public.capacitacion_tests (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  video_id uuid not null references public.capacitacion_videos(id) on delete cascade,
  correctas int not null,
  total int not null,
  aprobado boolean not null,
  created_at timestamptz not null default now()
);
alter table public.capacitacion_tests enable row level security;
grant select on public.capacitacion_tests to authenticated;
drop policy if exists ct_ver on public.capacitacion_tests;
create policy ct_ver on public.capacitacion_tests for select to authenticated using (public.usuario_en_mi_red(usuario_id));

-- materiales con test (para mostrar el botón)
create or replace function public.materiales_con_test() returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct video_id from capacitacion_preguntas
$$;
grant execute on function public.materiales_con_test() to authenticated;

-- 10 preguntas al azar, sin la respuesta correcta
create or replace function public.preguntas_test(p_video uuid, p_cant int default 10)
returns table(id uuid, capitulo text, pregunta text, opciones jsonb) language sql volatile security definer set search_path = public as $$
  select q.id, q.capitulo, q.pregunta, q.opciones from capacitacion_preguntas q
  where q.video_id = p_video and public.puede_operar()
  order by random() limit greatest(1, least(p_cant, 20))
$$;
grant execute on function public.preguntas_test(uuid, int) to authenticated;

-- corrige; aprueba con 70%; si aprueba marca el material como leído
create or replace function public.corregir_test(p_video uuid, p_respuestas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_total int := 0; v_ok int := 0; v_det jsonb := '[]'; r record; v_resp int; v_aprob boolean;
begin
  if auth.uid() is null or not public.puede_operar() then raise exception 'No autorizado'; end if;
  for r in select q.* from capacitacion_preguntas q where q.video_id = p_video and p_respuestas ? q.id::text loop
    v_total := v_total + 1;
    v_resp := (p_respuestas ->> r.id::text)::int;
    if v_resp = r.correcta then v_ok := v_ok + 1; end if;
    v_det := v_det || jsonb_build_object('id', r.id, 'correcta', r.correcta, 'ok', v_resp = r.correcta, 'explicacion', r.explicacion);
  end loop;
  if v_total = 0 then raise exception 'Test vacío'; end if;
  v_aprob := v_ok::numeric / v_total >= 0.7;
  insert into capacitacion_tests(usuario_id, video_id, correctas, total, aprobado) values (auth.uid(), p_video, v_ok, v_total, v_aprob);
  if v_aprob and not exists (select 1 from videos_vistos where usuario_id = auth.uid() and video_id = p_video) then
    insert into videos_vistos(usuario_id, video_id) values (auth.uid(), p_video);
  end if;
  return jsonb_build_object('correctas', v_ok, 'total', v_total, 'aprobado', v_aprob, 'detalle', v_det);
end $$;
grant execute on function public.corregir_test(uuid, jsonb) to authenticated;

-- bucket para PDFs de lecturas
insert into storage.buckets (id, name, public, file_size_limit) values ('lecturas', 'lecturas', true, 52428800)
on conflict (id) do update set public = true;
drop policy if exists lect_admin_write on storage.objects;
create policy lect_admin_write on storage.objects for all to authenticated using (bucket_id = 'lecturas' and public.es_admin()) with check (bucket_id = 'lecturas' and public.es_admin());

-- un material con test solo se marca aprobando el test (corregir_test es security definer)
drop policy if exists vv_alta on public.videos_vistos;
create policy vv_alta on public.videos_vistos for insert to authenticated
  with check (usuario_id = auth.uid() and public.puede_operar() and video_id not in (select public.materiales_con_test()));
