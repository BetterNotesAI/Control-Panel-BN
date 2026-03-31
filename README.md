# BetterNotes Admin Panel

Panel de control interno para BetterNotes construido con:

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + Postgres)

## Funcionalidades

- Login con Supabase Auth.
- Protección de `/dashboard` por:
  - usuario autenticado
  - email incluido en `ADMIN_EMAIL_ALLOWLIST`
- KPIs:
  - total users (`profiles`)
  - users created last 7 days
  - total documents
  - total problem solver sessions
  - feedback total
  - feedback new (`status='new'`)
- Actividad 7d/30d:
  - documentos por día
  - problem solver sessions por día
- Módulo feedback:
  - tabla paginada
  - filtros por `status`, `source`, texto y rango de fechas
  - detalle con mensaje completo
  - edición de `status` y `admin_note`
  - export CSV (respetando filtros aplicados)

## Seguridad

- `SUPABASE_SERVICE_ROLE_KEY` se usa solo server-side.
- Autorización admin soporta dos vías:
  - `profiles.admin_role` con valores `admin` o `superadmin` (recomendada).
  - `ADMIN_EMAIL_ALLOWLIST` como fallback.
- Todas las consultas sensibles van por API routes:
  - `GET /api/admin/kpis`
  - `GET /api/admin/activity?range=7d|30d`
  - `GET /api/admin/feedback`
  - `PATCH /api/admin/feedback/[id]`
  - `GET /api/admin/feedback/export`
- Middleware protege rutas de admin y redirige a `/login` si no hay acceso.

## Estructura

```text
src/
  app/
    api/admin/...
    dashboard/
    login/
  components/ui/
  modules/
    auth/
    dashboard/
    feedback/
  lib/
    auth/
    supabase/
    admin/
```

## Requisitos

- Node.js 20+ (recomendado Node 22)
- npm 10+

## Instalación

1. Instalar dependencias:

```bash
npm install
```

2. Crear variables de entorno:

```bash
cp .env.example .env.local
```

3. Completar `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL_ALLOWLIST=correo1@dominio.com,correo2@dominio.com
```

`ADMIN_EMAIL_ALLOWLIST` puede quedar vacío si usas `profiles.admin_role`.

4. Reiniciar el servidor de desarrollo después de cambiar variables:

```bash
# parar npm run dev y arrancar otra vez
npm run dev
```

## Desarrollo local

```bash
npm run dev
```

Abrir `http://localhost:3000`.

## Verificación

```bash
npm run lint
npm run build
```

## Despliegue

### Opción recomendada: Vercel

1. Importar el repositorio en Vercel.
2. Configurar las 4 variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL_ALLOWLIST`).
3. Deploy.

### Opción self-hosted

```bash
npm run build
npm run start
```

Y exponer el servicio en tu infraestructura.

## Nota sobre Supabase

Este panel espera que exista la tabla `public.user_feedback` (como la migración SQL que compartiste), además de `profiles`, `documents` y `problem_solver_sessions`.

### Migración recomendada para roles admin

Ejecuta:

[`supabase/migrations/20260331_add_profiles_admin_role.sql`](/Users/martimassomoreno/Desktop/Martí/BetterNotesAI/BetterNotes2/ControlPanelBN/CPanelBN/Control-Panel-BN/supabase/migrations/20260331_add_profiles_admin_role.sql)

Y luego marca tu usuario:

```sql
UPDATE public.profiles
SET admin_role = 'superadmin'
WHERE email = 'tu_email@dominio.com';
```
