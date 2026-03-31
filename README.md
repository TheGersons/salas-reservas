# Sistema de Reservas de Salas — Energía PD

Sistema completo para gestión de reservas de salas de reunión.
Stack: **NestJS + React + TypeScript + Prisma + PostgreSQL**

---

## Estructura del proyecto

```
salas-reservas/
├── backend/          NestJS API
└── frontend/         React + Vite + TailwindCSS
```

---

## Requisitos previos

- Node.js 18+
- PostgreSQL 14+
- npm 9+
- Cuenta SMTP (Gmail, Resend, SendGrid, etc.)

---

## Configuración del Backend

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores:

```env
# PostgreSQL
DATABASE_URL="postgresql://usuario:password@localhost:5432/salas_reservas"

# JWT (cambia este valor en producción)
JWT_SECRET="un-secreto-muy-largo-y-seguro"
JWT_EXPIRES_IN="8h"

# SMTP — ejemplo con Gmail
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="tu-correo@gmail.com"
SMTP_PASS="tu-app-password-de-gmail"
SMTP_FROM_NAME="Sistema de Salas"
SMTP_FROM_EMAIL="tu-correo@gmail.com"

# Admin inicial
ADMIN_EMAIL="admin@empresa.com"
ADMIN_PASSWORD="Admin123!"
```

> **Nota Gmail:** Necesitas activar "Contraseñas de aplicación" en tu cuenta Google.
> Ve a: Cuenta Google → Seguridad → Verificación en 2 pasos → Contraseñas de aplicación

### 3. Crear la base de datos

```bash
# Crear la base de datos en PostgreSQL
createdb salas_reservas

# O con psql:
# psql -U postgres -c "CREATE DATABASE salas_reservas;"
```

### 4. Ejecutar migraciones

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Seed inicial (salas + admin)

```bash
npx ts-node prisma/seed.ts
```

Esto crea:
- Sala **"Comedor"**
- Sala **"Sala Joel Osorto"**
- Admin con las credenciales del `.env`

### 6. Iniciar el servidor

```bash
# Desarrollo (hot reload)
npm run start:dev

# Producción
npm run build
npm run start
```

API disponible en: `http://localhost:3000`
Swagger docs: `http://localhost:3000/api/docs`

---

## Configuración del Frontend

### 1. Instalar dependencias

```bash
cd frontend
npm install
```

### 2. Iniciar en desarrollo

```bash
npm run dev
```

Frontend disponible en: `http://localhost:5173`

> El proxy de Vite redirige `/api` → `http://localhost:3000` automáticamente.

### 3. Build para producción

```bash
npm run build
```

---

## Uso del sistema

### Vista pública (sin login)

URL: `http://localhost:5173/`

1. Selecciona una sala: **Comedor** o **Sala Joel Osorto**
2. Navega el calendario semanal (solo lunes a viernes)
3. Haz clic en un slot blanco disponible
4. Selecciona la hora de finalización (bloques de 30 min)
5. Llena el formulario: nombre, correo, celular
6. Recibirás un correo de confirmación de recepción

**Colores del calendario:**
- Blanco = disponible (clic para reservar)
- Azul sólido = reserva confirmada
- Azul claro = reserva pendiente
- Gris = pasado / no disponible

### Panel de administración

URL: `http://localhost:5173/admin`

Credenciales: las que configuraste en `.env`

**Acciones disponibles:**
| Acción | Descripción |
|--------|-------------|
| Confirmar | Cambia estado a CONFIRMED, envía correo al solicitante |
| Cancelar | Cambia estado a CANCELLED, envía correo de cancelación |
| Eliminar | Elimina la reserva y notifica al solicitante |
| Recordatorio | Envía correo manual: 60min / 30min / 15min / general |

---

## Recordatorios automáticos (Cron)

El sistema envía recordatorios automáticamente cada 30 minutos (lunes a viernes, 07:00–18:00):

- **60 minutos antes** de la reunión
- **30 minutos antes** de la reunión  
- **15 minutos antes** de la reunión

Solo se envía una vez por tipo gracias a la tabla `ReminderLog`.

---

## Endpoints API

### Públicos
```
GET  /api/rooms                         Listar salas
GET  /api/reservations?roomId=&date=    Calendario público
POST /api/reservations                  Crear reservación
```

### Admin (requiere Bearer token)
```
POST   /api/auth/login                        Login
GET    /api/admin/reservations                Todas las reservaciones
PATCH  /api/admin/reservations/:id/status     Confirmar / Cancelar
DELETE /api/admin/reservations/:id            Eliminar
POST   /api/admin/reservations/:id/remind     Recordatorio manual
```

---

## Reglas de negocio

- Reservas solo de **lunes a viernes**
- Horario: **07:00 — 18:00**
- Bloques de **30 minutos**
- No se permiten **solapamientos** en la misma sala y fecha
- No se pueden reservar slots en el **pasado**
- Los correos se envían de forma **asíncrona** (no bloquean la respuesta)

---

## Producción

Para desplegar en producción recomendamos:

- **Backend:** Railway, Render, o cualquier VPS con Node 18+
- **Frontend:** Vercel, Netlify, o S3 + CloudFront
- **Base de datos:** Railway PostgreSQL, Supabase, o Neon
- **SMTP:** Resend (recomendado) o SendGrid

Recuerda cambiar `FRONTEND_URL` en el backend al dominio real para el CORS.
