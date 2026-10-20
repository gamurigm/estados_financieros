# Estados financieros

<p align='center'>
  <img src='mobile/assets/icon-finance.png' alt='Ícono de Estados financieros' width='180'>
</p>

<p align='center'>
  <img alt='Ionic React 9' src='https://img.shields.io/badge/Ionic_React-9-3880FF?style=flat-square&logo=ionic&logoColor=white'>
  <img alt='React Native 0.88' src='https://img.shields.io/badge/React_Native-0.88-20232A?style=flat-square&logo=react&logoColor=61DAFB'>
  <img alt='Expo SDK 58' src='https://img.shields.io/badge/Expo-SDK_58-000020?style=flat-square&logo=expo&logoColor=white'>
  <img alt='Express 5' src='https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white'>
  <img alt='Node.js 22' src='https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=nodedotjs&logoColor=white'>
  <img alt='PostgreSQL 17' src='https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white'>
  <img alt='Supabase' src='https://img.shields.io/badge/Supabase-Database-3FCF8E?style=flat-square&logo=supabase&logoColor=white'>
  <img alt='Render' src='https://img.shields.io/badge/Render-API-46E3B7?style=flat-square&logo=render&logoColor=white'>
  <img alt='Docker' src='https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white'>
</p>

Registro financiero mensual para web y Android. La web usa Ionic React; Android, React Native. La API usa Express y PostgreSQL, local con Docker o remoto. GitHub guarda el código y puede guardar respaldos cifrados de la base.

## Inicio local

Requisitos: Node.js y Docker Desktop.

1. Instala dependencias: `npm install`.
2. Prepara PostgreSQL: `npm run db:up`.
3. Aplica migraciones: `npm run db:migrate`.
4. Crea el acceso inicial: `npm run owner:create`. Escribe usuario y contraseña en la terminal.
5. Inicia la API y la web: `npm run local`.

Abre `http://127.0.0.1:5173`. El primer inicio crea `.env` con una contraseña local aleatoria. Los siguientes inicios aplican las migraciones automáticamente.

## Respaldos y cambio de equipo

`npm run backup` cifra la base con AES-256-GCM y sube `backup/database.dump.enc` al repositorio privado de GitHub. Usa una frase de al menos 12 caracteres y guárdala fuera de GitHub. Nunca subas un `.dump` sin cifrar.

En el equipo nuevo, clona el repositorio, ejecuta `npm install` y `npm run restore`; confirma con `REEMPLAZAR`. Usa la misma frase secreta. Antes de restaurar en un equipo existente, ejecuta `git pull`. Trabaja en un solo equipo a la vez y respalda antes de cambiar.

## Android

### Emulador local

1. Instala dependencias desde la raíz: `npm install` y `npm --prefix mobile install`.
2. En `mobile/.env`, configura `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001`.
3. Inicia la API: `npm run local`.
4. En otra terminal, ejecuta `npm --prefix mobile run android`.

La dirección `10.0.2.2` solo funciona desde el emulador Android.

### APK privado

Configura `mobile/.env` con la URL HTTPS pública de la API. En Windows, instala CMake 3.31.6 en el SDK de Android y ejecuta:

```powershell
npm run android:release
```

El APK queda en `mobile/android/app/build/outputs/apk/release/app-release.apk`. Usa el keystore local de depuración; sirve para uso personal, no para Google Play. Conserva el keystore para futuras actualizaciones.

La URL de la API queda dentro del APK; vuelve a compilarlo si cambia.

## API remota

- **Render y Supabase:** configura `DATABASE_URL` en Render con la URI Session pooler de Supabase. Pon la URL pública de la API en `mobile/.env`; nunca pongas credenciales de base de datos en la app.
- **Tailscale:** para usar la API de esta PC, inicia `npm run local` y ejecuta `tailscale serve --bg 3001` en PowerShell como administrador. Usa la URL HTTPS de Tailscale en `mobile/.env`. El acceso queda limitado al tailnet; la PC debe seguir encendida. No uses Funnel.
- **VPS:** requiere Docker, dominio apuntado al servidor y puertos 80/443 abiertos. Mantén cerrados los puertos de PostgreSQL y la API.

### Desplegar en VPS

1. Copia `.env.production.example` a `.env.production` y configura `APP_DOMAIN`, `POSTGRES_DB`, `POSTGRES_USER` y una contraseña hexadecimal larga.
2. Valida: `docker compose --env-file .env.production -f compose.prod.yml config`.
3. Despliega: `docker compose --env-file .env.production -f compose.prod.yml up -d --build`.
4. Crea el propietario por SSH: `docker compose --env-file .env.production -f compose.prod.yml exec api npm run owner:create`.

Caddy configura HTTPS automáticamente cuando el dominio apunta al VPS y los puertos están disponibles.

### Respaldos y migración de VPS

Configura `CLOUD_SSH_TARGET` y `CLOUD_REMOTE_DIR` en `.env.production`. Se requieren OpenSSH, GitHub CLI y un repositorio `origin` privado.

- `npm run backup:cloud`: cifra y publica el respaldo de producción. Usa la misma frase secreta que en `npm run backup`.
- `npm run restore:cloud`: restaura en producción tras confirmar `REEMPLAZAR PRODUCCION`.
- `npm run migrate:cloud`: envía la base local cifrada y pide `MIGRAR PRODUCCION` antes de reemplazar la base de producción. Conserva el propietario y las sesiones.
- `npm run verify:cloud`: compara rubros, saldos iniciales, movimientos y saldos calculados hasta la última fecha de origen. Si falla, no cambies clientes.

Estos comandos son manuales. `restore:cloud` reemplaza los datos de producción.
