# Estados financieros

Aplicación Ionic con PostgreSQL local. GitHub guarda el código y un respaldo cifrado de la base.

## Primer inicio

1. Instala Docker Desktop y Node.js.
2. Ejecuta `npm install`.
3. Ejecuta `npm run local`.

El primer inicio crea `.env` con una contraseña local aleatoria, inicia PostgreSQL y abre la app en `http://127.0.0.1:5173`.

## Mover el trabajo entre equipos

1. En el equipo nuevo, instala Docker Desktop, Node.js, Git y GitHub CLI; inicia sesión en GitHub.
2. Clona el repositorio privado y ejecuta `npm install`.
3. Ejecuta `npm run local` para crear una base vacía.
4. Ejecuta `git pull` y luego `npm run restore` para restaurar `backup/database.dump.enc`.
5. Trabaja en un solo equipo a la vez.
6. Al terminar, ejecuta `npm run backup`. Ingresa la misma frase secreta para cifrar; el script cifra, confirma y sube la copia a GitHub.

La frase secreta no se guarda en el repositorio. Consérvala fuera de GitHub; sin ella no se puede restaurar el respaldo. No subas una copia `.dump` sin cifrar.

## Datos y acceso

PostgreSQL escucha solo en `127.0.0.1`; no expone la base a la red. La app accede mediante una API local. El volumen de Docker conserva la base en ese equipo. GitHub sincroniza el código y el respaldo cifrado, no la base en vivo.
