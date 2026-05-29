# Control Horario

Aplicación web/PWA para control de fichajes y vacaciones de empleados.
Stack: **Next.js 14** + **Supabase** + **Vercel**

---

## Características

- **Empleados (móvil):**
  - Fichar entrada y salida con un botón
  - Registrar paradas (comida, médico, personal, otra)
  - Solicitar vacaciones y ver saldo disponible
  - Historial de horas con desglose mensual

- **Admin (escritorio):**
  - Ver estado en tiempo real de todos los empleados
  - Alertas de tardanzas y ausencias
  - Aprobar/rechazar solicitudes de vacaciones
  - Exportar Excel con horas del mes
  - Dar de alta empleados por email

- **Seguridad:**
  - Magic link (sin contraseña) — acceso por email
  - Políticas RLS: cada empleado solo ve sus datos
  - Admin tiene acceso completo

---

## Instalación

### 1. Clonar y configurar

```bash
git clone <tu-repo>
cd control-horario
npm install
cp .env.example .env.local
```

### 2. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea un proyecto
2. Ve a **SQL Editor** y ejecuta los archivos en orden:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
3. Ve a **Settings > API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configurar Auth en Supabase

1. Ve a **Authentication > URL Configuration**
2. Añade a **Redirect URLs**: `https://tu-dominio.vercel.app/auth/callback`
3. Para desarrollo local añade también: `http://localhost:3000/auth/callback`

### 4. Hacerte admin

Después de crear tu cuenta con magic link, ejecuta esto en Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'tu@email.com';
```

### 5. Dar de alta empleados

Desde el panel admin en `/admin/workers`, introduce el email del empleado y pulsa "Invitar". Recibirá un email con enlace de acceso.

---

## Desarrollo local

```bash
npm run dev
# Abre http://localhost:3000
```

---

## Despliegue en Vercel

1. Sube el proyecto a GitHub
2. En [vercel.com](https://vercel.com), importa el repositorio
3. Añade las variables de entorno (las del `.env.local`)
4. Despliega — Vercel detecta Next.js automáticamente

---

## Estructura del proyecto

```
control-horario/
├── app/
│   ├── auth/
│   │   ├── login/          # Página de login con magic link
│   │   └── callback/       # Callback de OAuth/magic link
│   ├── worker/
│   │   ├── clock/          # Página principal de fichaje
│   │   ├── vacations/      # Solicitud y seguimiento vacaciones
│   │   └── history/        # Historial de horas
│   ├── admin/
│   │   ├── dashboard/      # Panel principal con alertas
│   │   ├── workers/        # Gestión de empleados
│   │   └── vacations/      # Todas las solicitudes
│   └── api/
│       └── export/         # Exportación Excel
├── lib/
│   ├── supabase/           # Clientes Supabase (browser/server)
│   ├── clock.ts            # Utilidades de tiempo
│   └── actions/            # Server Actions
│       ├── clock.ts        # Fichajes
│       ├── vacations.ts    # Vacaciones
│       └── admin.ts        # Funciones de admin
├── types/
│   └── index.ts            # Tipos TypeScript
└── supabase/
    └── migrations/         # SQL para ejecutar en Supabase
        ├── 001_schema.sql  # Tablas y funciones
        └── 002_rls_policies.sql # Políticas de seguridad
```

---

## Personalización frecuente

| Qué cambiar | Dónde |
|---|---|
| Hora de inicio (alertas de tardanza) | `lib/actions/admin.ts` → `getTodayAlerts(workStartHour)` |
| Días de vacaciones por defecto | `supabase/migrations/001_schema.sql` → `vacation_days_total DEFAULT 22` |
| Tipos de parada | `types/index.ts` → `BreakType` y `lib/clock.ts` → `BREAK_LABELS` |
| Logo y nombre de la app | `app/layout.tsx` y `public/manifest.json` |
"# Horario" 
