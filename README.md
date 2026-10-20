# Estados financieros

Aplicación Ionic y Android React Native con PostgreSQL. La API puede usar Supabase desde Render o PostgreSQL local con Docker. GitHub guarda el código y un respaldo cifrado de la base.

## Primer inicio

1. Instala Docker Desktop y Node.js.
2. Ejecuta `npm install`.
3. En el primer inicio, ejecuta `npm run db:up` y `npm run db:migrate`.
4. Ejecuta `npm run owner:create` en una terminal interactiva e ingresa el usuario y la contraseña del propietario. El comando no acepta credenciales como argumentos.
5. Ejecuta `npm run local` para iniciar la aplicación. Los siguientes inicios aplican cualquier migración pendiente automáticamente.

El primer inicio crea `.env` con una contraseña local aleatoria, inicia PostgreSQL y abre la app en `http://127.0.0.1:5173`. Después de ingresar datos, ejecuta `npm run backup` para crear la primera copia en GitHub.

## Mover el trabajo entre equipos

1. En el equipo nuevo, instala Docker Desktop, Node.js, Git y GitHub CLI; inicia sesión en GitHub.
2. Clona el repositorio privado y ejecuta `npm install`.
3. Ejecuta `git pull` para traer el respaldo cifrado más reciente.
4. Ejecuta `npm run restore` y escribe `REEMPLAZAR` para cargar el respaldo en PostgreSQL local.
5. Ejecuta `npm run local` para abrir la app.
6. Trabaja en un solo equipo a la vez.
7. Al terminar, ejecuta `npm run backup`. Ingresa la misma frase secreta para cifrar; el script cifra, confirma y sube la copia a GitHub.

La frase secreta no se guarda en el repositorio. Consérvala fuera de GitHub; sin ella no se puede restaurar el respaldo. No subas una copia `.dump` sin cifrar.

## Datos y acceso

En modo local, PostgreSQL escucha solo en `127.0.0.1`; no expone la base a la red. La app accede mediante una API local. El volumen de Docker conserva la base en ese equipo. GitHub sincroniza el código y el respaldo cifrado, no la base en vivo.

## Android con Render y Supabase

La app envía cada alta, edición o eliminación a la API de Render. La API guarda esos cambios directamente en PostgreSQL Supabase; requiere internet.

1. En Render, configura `DATABASE_URL` con la URI Session pooler de Supabase. La URI y su contraseña pertenecen al servidor; mantenlas fuera de Git y de la app móvil.
2. Configura `mobile/.env` con `EXPO_PUBLIC_API_BASE_URL=https://estados-financieros-c98w.onrender.com`.
3. En Windows, instala CMake 3.31.6 en el SDK Android y ejecuta `npm run android:release` desde la raíz del repositorio. El comando usa los certificados confiables de Windows y selecciona esa versión de CMake para admitir rutas largas.
4. Instala `mobile/android/app/build/outputs/apk/release/app-release.apk` en Android e inicia sesión con el propietario migrado.

La URL de la API queda incluida en cada APK. Si cambias `mobile/.env`, genera e instala una APK nueva. Los cambios financieros posteriores se guardan en Supabase sin volver a migrar datos ni publicar código en GitHub.

## Acceso Android privado y gratuito con Tailscale

La opción sin VPS ni dominio mantiene la base y la API en esta PC. Instala [Tailscale para Windows](https://tailscale.com/download/windows) y [Android](https://tailscale.com/docs/install/android), e inicia sesión con la misma cuenta personal en ambos dispositivos. En Android, deja Tailscale conectado al usar la app.

1. Inicia PostgreSQL, la API y la web con `npm run local`; deja esa terminal abierta en la PC.
2. Solo la primera vez, ejecuta `npm run owner:create` en otra terminal y crea el único acceso. No lo ejecutes si el propietario ya existe.
3. En PowerShell como administrador, ejecuta `tailscale serve --bg 3001`. Tailscale mostrará una URL HTTPS `https://<pc>.<tailnet>.ts.net`, accesible solo desde dispositivos autorizados en tu tailnet. No uses Funnel.
4. Crea `mobile/.env` con `EXPO_PUBLIC_API_BASE_URL=` seguido de la URL HTTPS exacta que mostró Tailscale.
5. Genera e instala el APK privado siguiendo la sección Android de este README.

La API sigue enlazada a `127.0.0.1`; Tailscale Serve la publica solo dentro del tailnet y termina HTTPS. PostgreSQL permanece en esta PC y no se publica. La PC y su conexión a internet deben permanecer activas. Si se apaga o `npm run local` termina, Android no podrá conectar.

## Preparar el servicio en la nube

El despliegue requiere un VPS con Docker y un dominio propio. Apunta el dominio al VPS y permite tráfico TCP por los puertos 80 y 443. No publiques los puertos de PostgreSQL ni de la API.

1. Copia `.env.production.example` a `.env.production` y configura `APP_DOMAIN`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` fuera de Git.
2. Usa una contraseña PostgreSQL aleatoria hexadecimal larga; Compose la incorpora a `DATABASE_URL` para el servicio `db`.
3. Valida la configuración con `docker compose --env-file .env.production -f compose.prod.yml config`.
4. Inicia el stack con `docker compose --env-file .env.production -f compose.prod.yml up -d --build`.

Caddy solicita y renueva HTTPS automáticamente cuando el dominio resuelve al VPS y los puertos están disponibles. La API aplica migraciones pendientes antes de iniciar. Crea el usuario propietario desde una terminal SSH interactiva con `docker compose --env-file .env.production -f compose.prod.yml exec api npm run owner:create`.

## Respaldos y migración de nube

Configura `CLOUD_SSH_TARGET` como alias de `~/.ssh/config` o `usuario@host`; apunta `CLOUD_REMOTE_DIR` a la carpeta del stack en el VPS. Requiere OpenSSH, GitHub CLI y `origin` privado. Los comandos leen `.env.production` local y no copian la contraseña de cifrado ni credenciales GitHub al VPS.

- `npm run backup:cloud` descarga `pg_dump` por SSH, cifra la copia con AES-256-GCM y publica solo `backup/database.dump.enc` en GitHub. Escribe la misma frase secreta que usas en `npm run backup`.
- `npm run restore:cloud` pide la frase y la confirmación exacta `REEMPLAZAR PRODUCCION` antes de reemplazar datos en el VPS.
- `npm run migrate:cloud` cifra y publica una copia local; luego pide `MIGRAR PRODUCCION` antes de enviar esa misma copia al VPS. Conserva el usuario y las sesiones ya creadas en producción.
- `npm run verify:cloud` compara rubros, saldos iniciales, cantidad de movimientos y saldos calculados hasta la última fecha de origen. No cambies los clientes si la verificación falla.

Los respaldos y migraciones son manuales. No ejecutes restauración en nube salvo que solicites reemplazar los datos de producción.

La configuración no se despliega ni migra por sí sola. Antes, selecciona VPS y dominio; después sigue este flujo.

## Android con React Native

1. Ejecuta `npm install` en la raíz y `npm --prefix mobile install`.
2. Crea `mobile/.env` con `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001` para Android Emulator local. Esa URL solo funciona durante desarrollo.
3. Inicia la API y PostgreSQL con `npm run local`.
4. En otra terminal, ejecuta `npm --prefix mobile run android` y abre la app en el emulador.

### Crear APK privado

Después de configurar `mobile/.env` con la URL HTTPS real, genera el APK desde PowerShell en la raíz del repositorio:

```powershell
npm run android:release
```

El archivo queda en `mobile/android/app/build/outputs/apk/release/app-release.apk`. Copia ese archivo al teléfono e instálalo desde Android. Esta configuración firma el APK con el keystore local de depuración; sirve para uso personal, no para Google Play. Conserva el keystore para poder actualizar la instalación.

La app usa Expo Router. Guarda solo el refresh token en Expo SecureStore y mantiene el token de acceso en memoria. Para usar la base online desde cualquier lugar, sigue la sección Render y Supabase. Tailscale y VPS quedan como alternativas.
