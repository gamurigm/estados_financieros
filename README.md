# Estados financieros

<p align="center">
  <img src="mobile/assets/icon-finance.png" alt="Icono de Estados financieros" width="160" />
</p>

Libro financiero personal para web y Android. La app móvil está hecha con React Native; ambas versiones usan una API y una base de datos PostgreSQL.

## Desarrollo en Android Emulator

Requisitos: Node.js, Docker Desktop y Android Studio con un emulador configurado.

```powershell
npm install
npm --prefix mobile install
npm run local
```

`npm run local` prepara PostgreSQL, aplica migraciones y levanta la API y la web en `http://127.0.0.1:5173`. La primera vez, crea el propietario desde otra terminal:

```powershell
npm run owner:create
```

En `mobile/.env`, configura la API local del emulador y luego inicia Android:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001
```

```powershell
npm --prefix mobile run android
```

## Android con Render y Supabase

Render ejecuta la API y guarda los datos en Supabase. La app requiere internet; cada cambio se sincroniza al guardarlo.

1. En Render, configura `DATABASE_URL` con la URI Session pooler de Supabase. Déjala como variable privada del servicio; nunca la pongas en la app.
2. Copia `mobile/.env.example` a `mobile/.env`. Configura `EXPO_PUBLIC_API_BASE_URL` con la URL HTTPS de tu API.
3. En Windows, instala CMake 3.31.6 en Android SDK Tools. Desde la raíz del proyecto, crea la APK:

   ```powershell
   npm run android:release
   ```

4. Instala `mobile/android/app/build/outputs/apk/release/app-release.apk` en el teléfono e inicia sesión.

La URL de la API queda dentro de la APK. Si cambia, actualiza `mobile/.env` y vuelve a compilar. La APK de uso personal se firma con la clave de depuración local y no sirve para publicar en Google Play.

## Comandos útiles

| Comando | Uso |
| --- | --- |
| `npm run local` | Inicia PostgreSQL, la API y la web para desarrollo. |
| `npm run build` | Compila la versión web. |
| `npm run android:release` | Genera la APK Android. |
| `npm run backup` | Cifra y sube a GitHub un respaldo de la base local. |
| `npm run restore` | Restaura un respaldo cifrado en la base local. |

Guarda la frase de cifrado del respaldo fuera de GitHub. Sin ella no se puede restaurar.
