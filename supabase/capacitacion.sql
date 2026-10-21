-- Capacitación: categorías, idioma de los videos y pendientes de contenido
create table if not exists public.capacitacion_categorias (
  slug text primary key, nombre text not null, emoji text, orden int not null default 0);
alter table public.capacitacion_categorias enable row level security;
grant select, insert, update, delete on public.capacitacion_categorias to authenticated;
drop policy if exists cc_ver on public.capacitacion_categorias;
create policy cc_ver on public.capacitacion_categorias for select to authenticated using (true);
drop policy if exists cc_admin on public.capacitacion_categorias;
create policy cc_admin on public.capacitacion_categorias for all to authenticated using (public.es_admin()) with check (public.es_admin());

alter table public.capacitacion_videos add column if not exists idioma text not null default 'es';
alter table public.capacitacion_videos add column if not exists fuente text;

create table if not exists public.capacitacion_pendientes (
  id uuid primary key default gen_random_uuid(),
  categoria text references public.capacitacion_categorias(slug) on update cascade on delete set null,
  titulo text not null,
  accion text not null check (accion in ('subtitular','traducir','grabar','resumir','enlazar')),
  fuente text, url text, nota text,
  hecho boolean not null default false,
  created_at timestamptz not null default now());
alter table public.capacitacion_pendientes enable row level security;
grant select, insert, update, delete on public.capacitacion_pendientes to authenticated;
drop policy if exists cp_admin on public.capacitacion_pendientes;
create policy cp_admin on public.capacitacion_pendientes for all to authenticated using (public.es_admin()) with check (public.es_admin());


insert into public.capacitacion_categorias (slug,nombre,emoji,orden) values
('cierre','Cierre de ventas','🤝',0),
('objeciones','Objeciones y negociación','🛡️',1),
('setting','Setting: conseguir demos','📲',2),
('prospeccion','Prospección y referidos','🔎',3),
('demo','Demo y producto','🍳',4),
('oratoria','Oratoria y comunicación','🎤',5),
('tiempo','Gestión del tiempo','⏰',6),
('finanzas','Finanzas personales','💰',7),
('motivacion','Motivación y mentalidad','🔥',8),
('desarrollo','Desarrollo personal','🌱',9),
('emocional','Inteligencia emocional','💛',10),
('marketing','Marketing digital y redes','📣',11),
('liderazgo','Liderazgo y reclutamiento','👑',12),
('servicio','Atención y postventa','⭐',13),
('credito','Crédito, cuotas y cobranza','💳',14),
('cocina','Cocina saludable','🥗',15),
('etica','Ética y defensa del consumidor','⚖️',16),
('salud','Salud y energía','💪',17)
on conflict (slug) do update set nombre=excluded.nombre, emoji=excluded.emoji, orden=excluded.orden;

-- Contenido inicial (videos en español o con subtítulos en español, verificados embebibles)
insert into public.capacitacion_videos (titulo,url,categoria,idioma,orden)
select v.* from (values
('Psicología de ventas de Brian Tracy (resumen animado)','https://www.youtube.com/watch?v=g9Q5Pf9sijE','cierre','es',1),
('Psicología de ventas: 10 claves para vender más','https://www.youtube.com/watch?v=7AbfX_s2k_8','cierre','es',2),
('Véndele a la mente, no a la gente (Jürgen Klarić)','https://www.youtube.com/watch?v=h3XUYhunIXU','cierre','es',3),
('Tips de neuroventas (Jürgen Klarić)','https://www.youtube.com/watch?v=w9bN5tJ0js8','cierre','es',4),
('Conferencia de ventas, parte 1 (Jürgen Klarić)','https://www.youtube.com/watch?v=EO2h32CA10E','cierre','es',5),
('4 estrategias para cerrar ventas (Alex Dey)','https://www.youtube.com/watch?v=XeJbPQgnenM','cierre','es',6),
('Cómo responder "es muy caro"','https://www.youtube.com/watch?v=Q5mYrXWA_w4','objeciones','es',1),
('Manejo de objeciones y cierres (Margarita Pasos)','https://www.youtube.com/watch?v=kjfQpwGMR6M','objeciones','es',2),
('Manual para el manejo de objeciones','https://www.youtube.com/watch?v=zy8iXDtPtnE','objeciones','es',3),
('Cómo responder WhatsApp para vender más: guion','https://www.youtube.com/watch?v=eumlf3uvXrU','setting','es',1),
('7 errores que matan tus ventas por WhatsApp','https://www.youtube.com/watch?v=jvdpkhsA1OA','setting','es',2),
('La fórmula para cerrar clientes por WhatsApp','https://www.youtube.com/watch?v=qZWlTIXLIFI','setting','es',3),
('3 estrategias para pedir referidos sin incomodar','https://www.youtube.com/watch?v=6kRBDhr8MDE','prospeccion','es',1),
('Cómo pedir referidos','https://www.youtube.com/watch?v=xM3iNi4cS4w','prospeccion','es',2),
('Sistema de prospección para conseguir clientes','https://www.youtube.com/watch?v=l5Et6NFTVj8','prospeccion','es',3),
('Fanatical Prospecting: clientes todos los días (resumen)','https://www.youtube.com/watch?v=7YjiUc3WE0s','prospeccion','es',4),
('El secreto de TED para hablar bien en público (Chris Anderson)','https://www.youtube.com/watch?v=-FOCpMAww28','oratoria','sub',1),
('Cómo hablar para que la gente quiera escucharte (Julian Treasure)','https://www.youtube.com/watch?v=eIho2S0ZahI','oratoria','sub',2),
('5 maneras de escuchar mejor (Julian Treasure)','https://www.youtube.com/watch?v=cSohjlYQI2A','oratoria','sub',3),
('Clase de oratoria: el ABC para hablar en público (Daniel Colombo)','https://www.youtube.com/watch?v=pJgyT3LVow0','oratoria','es',4),
('9 técnicas para ampliar tu vocabulario (Daniel Colombo)','https://www.youtube.com/watch?v=OV570NuBSXw','oratoria','es',5),
('25 técnicas para abrir tus presentaciones (Daniel Colombo)','https://www.youtube.com/watch?v=MPXGM84PzF4','oratoria','es',6),
('Cómo quitarte las muletillas (Daniel Colombo)','https://www.youtube.com/watch?v=kLsnNPF1gqw','oratoria','es',7),
('Cómo escuchar lo que la gente no dice (Víctor Küppers)','https://www.youtube.com/watch?v=Z3_f6a-YrY8','oratoria','es',8),
('¡Tráguese ese sapo! de Brian Tracy (resumen)','https://www.youtube.com/watch?v=93Gi-ZWVwng','tiempo','es',1),
('Técnica Pomodoro (animado)','https://www.youtube.com/watch?v=3D0-l2O5k8Y','tiempo','es',2),
('Domina tu tiempo (TEDx)','https://www.youtube.com/watch?v=wFIzmUBPCBQ','tiempo','es',3),
('¿Estás fuera de tus cabales? (David Allen, TEDx)','https://www.youtube.com/watch?v=N1qfAoQEoWY','tiempo','sub',4),
('Aprender a planear nuestra vida','https://www.youtube.com/watch?v=FmlFrPMOBro','tiempo','es',5),
('El hombre más rico de Babilonia (resumen animado)','https://www.youtube.com/watch?v=jcRQcUJmPsM','finanzas','es',1),
('Educación financiera para principiantes','https://www.youtube.com/watch?v=9sCVcWD1Svs','finanzas','es',2),
('Cómo organizar tu dinero: ingresos, gastos y presupuesto','https://www.youtube.com/watch?v=Rir3GoHwgVs','finanzas','es',3),
('Curso: cómo organizar tus finanzas personales','https://www.youtube.com/watch?v=ap_tK2-HSN0','finanzas','es',4),
('Cuidar el ánimo, nuestro principal recurso (Víctor Küppers)','https://www.youtube.com/watch?v=UhgM4d0QQtw','motivacion','es',1),
('La clave es tener un sentido de vida (Emilio Duró)','https://www.youtube.com/watch?v=oeGWtyMAbKk','motivacion','es',2),
('15 minutos de pura genialidad (Emilio Duró)','https://www.youtube.com/watch?v=nseLteyJbMk','motivacion','es',3),
('Despierta el potencial que llevas dentro (Mario Alonso Puig)','https://www.youtube.com/watch?v=2WaL95mNb6c','motivacion','es',4),
('Cómo ser la mejor versión de ti mismo (Mario Alonso Puig)','https://www.youtube.com/watch?v=f69n5VQLIQw','desarrollo','es',1),
('Cómo dejar de boicotearte (Mel Robbins, TEDx)','https://www.youtube.com/watch?v=Lp7E973zozc','desarrollo','sub',2),
('Vales lo que vale tu calidad humana (Víctor Küppers)','https://www.youtube.com/watch?v=ixf9qPho6wA','desarrollo','es',3),
('El poder de la vulnerabilidad (Brené Brown, TED)','https://www.youtube.com/watch?v=iCvmsMzlF7o','emocional','sub',1),
('Lo que aprendí en 100 días de rechazo (Jia Jiang, TED)','https://www.youtube.com/watch?v=-vZXgApsPCQ','emocional','sub',2),
('Aprende a poner límites (Mario Alonso Puig)','https://www.youtube.com/watch?v=5H0mpHJa7xg','emocional','es',3),
('Marketing en buscadores (Google Actívate)','https://www.youtube.com/watch?v=dALHXlA6E7Y','marketing','es',1),
('Marketing digital y redes sociales: curso completo','https://www.youtube.com/watch?v=oYh8X8Z-WKU','marketing','es',2),
('Cómo los grandes líderes inspiran la acción (Simon Sinek, TED)','https://www.youtube.com/watch?v=qp0HIF3SfI4','liderazgo','sub',1),
('Crecer haciendo brillar a los demás (Mario Alonso Puig)','https://www.youtube.com/watch?v=kCJkyuhbO10','liderazgo','es',2),
('9 consejos para un buen servicio al cliente (HubSpot)','https://www.youtube.com/watch?v=5W-WOZ9zQfM','servicio','es',1),
('La importancia del buen servicio (TEDx)','https://www.youtube.com/watch?v=ZdskuZHVA9w','servicio','es',2),
('Claves de la atención y el servicio al cliente','https://www.youtube.com/watch?v=gIxRkx2IH3E','servicio','es',3),
('Guías alimentarias argentinas, parte 1','https://www.youtube.com/watch?v=svFC__T2v6M','cocina','es',1),
('Guías alimentarias argentinas, parte 2','https://www.youtube.com/watch?v=-O6aTeGHH64','cocina','es',2),
('¿Cuándo se aplica la Ley de Defensa del Consumidor?','https://www.youtube.com/watch?v=GHaQXLf14pg','etica','es',1),
('Derecho de arrepentimiento (Defensa del Consumidor)','https://www.youtube.com/watch?v=kBg575um3T0','etica','es',2),
('La garantía según la Ley 24.240','https://www.youtube.com/watch?v=Q5xZEtdkN84','etica','es',3),
('Dormir es tu superpoder (Matt Walker, TED)','https://www.youtube.com/watch?v=5MuIMqhT8DM','salud','sub',1),
('Ejercicios para el cuidado de la voz, 1','https://www.youtube.com/watch?v=2PtHSoTgwqQ','salud','es',2),
('Ejercicios para el cuidado de la voz, 3','https://www.youtube.com/watch?v=SwAwfuk_7x4','salud','es',3),
('Ejercicios para el cuidado de la voz, 4','https://www.youtube.com/watch?v=wmeGrmZ0VeI','salud','es',4)
) as v(titulo,url,categoria,idioma,orden)
where not exists (select 1 from public.capacitacion_videos x where x.url = v.url);

insert into public.capacitacion_pendientes (categoria,titulo,accion,fuente,nota)
select v.* from (values
('cierre','Brian Tracy: psicología de ventas y cierres (canal oficial, inglés)','subtitular','Brian Tracy','YouTube oficial en inglés; no hay versión oficial en español. Activar subtítulos automáticos o grabar resúmenes propios.'),
('cierre','Zig Ziglar: técnicas de cierre (canal oficial Ziglar)','subtitular','Ziglar Inc.','Inglés. Las versiones en español que circulan son re-subidas no oficiales.'),
('cierre','Grant Cardone y Alex Hormozi: precio y oferta irresistible','subtitular','YouTube oficial','Inglés.'),
('cierre','The Art of Money Getting (P. T. Barnum)','traducir','Dominio público','Libro libre: traducir y narrar como mini-curso propio.'),
('cierre','Acres of Diamonds (Russell Conwell)','traducir','Dominio público','Libro libre: traducir y narrar.'),
('objeciones','Chris Voss: negociación (''Rompe la barrera del no'')','resumir','Libro / MasterClass','Resumen propio en video.'),
('objeciones','Banco de objeciones Royal (''es caro'', ''lo hablo con mi pareja'', ''ya tengo ollas'')','grabar','Material propio','Grabar respuestas de los mejores vendedores.'),
('setting','Alex Hormozi y Cole Gordon: scripts de appointment setting','subtitular','YouTube oficial','Inglés.'),
('setting','Guiones propios de WhatsApp: primer contacto, referidos, reactivar clientes, confirmar demo','grabar','Material propio',null),
('prospeccion','Joe Girard: la ley de 250 y el seguimiento','subtitular','Charlas en YouTube','Inglés.'),
('prospeccion','Jeffrey Gitomer: venta por relaciones','subtitular','YouTube oficial','Inglés.'),
('prospeccion','HubSpot Academy: curso Inbound Sales (gratis, con certificado)','enlazar','HubSpot Academy','Curso externo: cargar el link y pedir el certificado.'),
('demo','Guion de la demo Royal: cocina sin agua ni aceite, comparación con ollas comunes','grabar','Material propio',null),
('demo','Material oficial de Royal Prestige / Hy Cite','enlazar','Distribución','Pedirlo a la compañía.'),
('oratoria','The Art of Public Speaking (Dale Carnegie, 1915)','traducir','Dominio público en Argentina desde 2026','Traducir desde el original en inglés (las traducciones modernas tienen dueño).'),
('oratoria','Curso de oratoria 100% práctico (Daniel Colombo)','enlazar','Daniel Colombo','El autor no permite embeberlo: dejar link a YouTube.'),
('tiempo','How to Live on 24 Hours a Day (Arnold Bennett, 1908)','traducir','Dominio público',null),
('tiempo','David Allen: The Art of Stress-Free Productivity (TEDx)','subtitular','TEDx','Inglés; revisar si tiene subtítulos en español.'),
('finanzas','The Way to Wealth (Benjamin Franklin)','traducir','Dominio público',null),
('finanzas','The Science of Getting Rich (Wallace Wattles, 1910)','traducir','Dominio público',null),
('finanzas','Khan Academy: finanzas personales','enlazar','Khan Academy','Gran parte en inglés; buscar lo disponible en español.'),
('finanzas','Cómo administrar comisiones variables y meses flojos','grabar','Material propio',null),
('motivacion','Jim Rohn y Les Brown: charlas completas','subtitular','Canales oficiales','Inglés; las versiones en español son re-subidas no oficiales.'),
('motivacion','As a Man Thinketh (James Allen) y A Message to Garcia (Elbert Hubbard)','traducir','Dominio público',null),
('desarrollo','Self-Help (Samuel Smiles, 1859) y Pushing to the Front (O. S. Marden)','traducir','Dominio público',null),
('desarrollo','Brian Tracy: metas y ''Sin excusas''','subtitular','Brian Tracy','Inglés.'),
('emocional','Daniel Goleman: inteligencia emocional','subtitular','Charlas y entrevistas','Inglés.'),
('marketing','Google Actívate: curso completo de marketing digital (gratis, con certificado)','enlazar','Google Actívate',null),
('marketing','Meta Blueprint: Facebook e Instagram (gratis)','enlazar','Meta',null),
('marketing','Cómo publicar demos y recetas en Instagram y estados de WhatsApp','grabar','Material propio',null),
('liderazgo','John C. Maxwell: Las 21 leyes del liderazgo','subtitular','Canal oficial','No encontré versión oficial en español; las que hay son audiolibros re-subidos.'),
('liderazgo','Entrevista de reclutamiento, primer mes del nuevo vendedor, acompañar una demo','grabar','Material propio',null),
('servicio','Shep Hyken: experiencia del cliente','subtitular','YouTube oficial','Inglés.'),
('servicio','Guion de visita de servicio: garantía, uso, referidos y accesorios','grabar','Material propio',null),
('credito','Explicar cuotas con el Cotizador, calificar al cliente, qué hacer ante atrasos','grabar','Material propio',null),
('credito','Educación financiera del BCRA: crédito y tasas','enlazar','BCRA',null),
('cocina','Recetas Royal en video','grabar','Material propio','Conecta con la sección Recetas.'),
('etica','Qué se puede y qué no se puede prometer al cliente','grabar','Material propio',null),
('salud','Manejo del estrés para vendedores','resumir','Varios',null)
) as v(categoria,titulo,accion,fuente,nota)
where not exists (select 1 from public.capacitacion_pendientes x where x.titulo = v.titulo);
