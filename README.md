# Estados financieros

Aplicación Ionic con PostgreSQL local. GitHub guarda el código y un respaldo cifrado de la base.

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

PostgreSQL escucha solo en `127.0.0.1`; no expone la base a la red. La app accede mediante una API local. El volumen de Docker conserva la base en ese equipo. GitHub sincroniza el código y el respaldo cifrado, no la base en vivo.

## Preparar el servicio en la nube

El despliegue requiere un VPS con Docker y un dominio propio. Apunta el dominio al VPS y permite tráfico TCP por los puertos 80 y 443. No publiques los puertos de PostgreSQL ni de la API.

1. Copia `.env.production.example` a `.env.production` y configura `APP_DOMAIN`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD` fuera de Git.
2. Usa una contraseña PostgreSQL aleatoria hexadecimal larga; Compose la incorpora a `DATABASE_URL` para el servicio `db`.
3. Valida la configuración con `docker compose --env-file .env.production -f compose.prod.yml config`.
4. Inicia el stack con `docker compose --env-file .env.production -f compose.prod.yml up -d --build`.

Caddy solicita y renueva HTTPS automáticamente cuando el dominio resuelve al VPS y los puertos están disponibles. La API aplica migraciones pendientes antes de iniciar. Crea el usuario propietario desde una terminal SSH interactiva con `docker compose --env-file .env.production -f compose.prod.yml exec api npm run owner:create`.

La configuración no se despliega ni migra por sí sola. Antes, selecciona VPS y dominio; después usa `npm run migrate:cloud` y `npm run verify:cloud` siguiendo las instrucciones de respaldo.

## Android con React Native

1. Ejecuta `npm install` en la raíz y `npm --prefix mobile install`.
2. Crea `mobile/.env` con `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001` para Android Emulator local. Esa URL solo funciona durante desarrollo.
3. Inicia la API y PostgreSQL con `npm run local`.
4. En otra terminal, ejecuta `npm --prefix mobile run android` y abre la app en el emulador.

La app usa Expo Router. Guarda solo el refresh token en Expo SecureStore y mantiene el token de acceso en memoria. Para usarla desde cualquier lugar se requiere un API publicado con HTTPS y una URL HTTPS en `EXPO_PUBLIC_API_BASE_URL`; falta elegir y preparar el VPS y el dominio antes de generar el APK privado.
