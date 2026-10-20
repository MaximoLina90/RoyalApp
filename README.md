# Royal App

Web app (desktop + mobile) para el equipo de ventas **Royal Prestige®**. Reconstrucción de la app Android original (`com.example.royal`).

## Funciones
- **Login / Registro** con verificación de email y palabra clave del equipo (validada en el servidor, guardada con bcrypt).
- **Catálogo**: 10 categorías, búsqueda, ficha de producto con foto y descripción.
- **Cotizador**: carrito, contado o financiado con entrega 10/20/30% y 3/6/9/12/14/18 cuotas. Cuota = (total − entrega) × factor; importe diario = cuota ÷ 31. Compartir por WhatsApp.
- **Pedidos**: confirmación con número correlativo por vendedor, historial y detalle.
- **Agenda**: calendario mensual con Demo, Entrevista, Capacitación, Servicio y Otro.
- **Estadísticas**: ventas mensuales, anuales e históricas, mejor venta, promedio y gráfico.
- **Administración** (rol admin): productos, precios y fotos; factores de cuotas; palabra clave; roles del equipo.

## Stack
Next.js 14 (App Router) · Tailwind · Supabase (Auth, Postgres con RLS, Storage) · Recharts · Vercel.

## Setup
1. `supabase/schema.sql`, `supabase/seed.sql` y `supabase/marketplace.sql` en el SQL Editor de Supabase.
2. Variables: copiar `.env.example` a `.env.local`.
3. `npm install && npm run dev`.

Para hacer admin a alguien: `update profiles set rol = 'admin' where email = '...';`
