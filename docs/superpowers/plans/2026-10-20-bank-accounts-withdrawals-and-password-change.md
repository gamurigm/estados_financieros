# Cuentas bancarias, retiros y cambio de contraseña — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Permitir varias cuentas bancarias, retiros banco→efectivo y cambio seguro de contraseña en web y Android.

**Architecture:** Extender `accounts` con tipo y fecha de inicio; conservar `cash` y `bank` como claves compatibles. La API devuelve cuentas detalladas y mantiene `opening` para versiones anteriores. Los retiros siguen siendo transferencias para no afectar ingresos ni gastos. El endpoint de contraseña verifica la sesión y actualiza el hash junto con la revocación de sesiones en una transacción.

**Tech Stack:** PostgreSQL, Express 5, React/Ionic, Expo React Native, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-20-bank-accounts-and-cash-withdrawals.md`

## Global Constraints

- Mantener movimientos existentes, claves `cash`/`bank` y saldos históricos.
- Las cuentas bancarias nuevas comienzan hoy; efectivo sigue siendo una sola cuenta.
- Retiros cambian saldos y no cuentan como ingreso ni gasto.
- El cambio de contraseña exige la actual, guarda Argon2id y cierra todas las sesiones.
- Mantener validación TLS estricta y no modificar datos de producción durante esta implementación.

## Review Focus

- Payload antiguo con `bank`: sigue funcionando y conserva movimientos.
- Cuenta nueva: la fecha inicial no modifica meses anteriores.
- Retiro desde efectivo o cuenta inexistente: API rechaza sin insertar.
- Contraseña incorrecta o confirmación distinta: hash y sesiones no cambian.
- Cambio correcto: todas las sesiones quedan inválidas y el nuevo password permite entrar.

---

### Task 1: Modelo de cuentas y API

**Files:** `db/init/001-schema.sql`, `db/migrations/002-bank-accounts.sql`, `server/app.ts`, `server/auth-routes.test.ts`, `scripts/migrate-supabase.mjs`, `scripts/verify-cloud.mjs`.

**Interfaces:** Estado API añade `accounts: { id, name, kind, openingBalance, startDate }[]` y conserva `opening`. Añade `POST /api/accounts` y permite actualizar nombre/saldo con `PUT /api/accounts/:key`. Movimientos aceptan IDs de cuenta existentes.

- [x] Escribir pruebas de estado, creación de banco, movimiento legado `bank`, movimiento con ID nuevo y rechazo de cuenta inválida.
- [x] Ejecutar `npm run test:server` y confirmar fallos esperados.
- [x] Añadir migración idempotente y actualizar API, esquema inicial y scripts de migración/verificación.
- [x] Ejecutar `npm run test:server` y confirmar suite verde.

### Task 2: Gestión bancaria y retiros en web

**Files:** `src/api.ts`, `src/App.tsx`, `src/styles.css`.

**Interfaces:** `AccountId` es string; `FinanceState.accounts` es fuente de opciones; el retiro guarda `kind: 'transfer'` desde banco a efectivo.

- [x] Añadir o ajustar pruebas de cliente si cambian contratos reutilizados.
- [x] Mostrar efectivo, cada banco y Débito total; gestionar nombre y saldo; añadir cuentas nuevas.
- [x] Añadir acción dedicada Retirar con cuenta bancaria de origen.
- [x] Ejecutar `npm run build` y pruebas web/server.

### Task 3: Gestión bancaria y retiros en Android

**Files:** `mobile/src/api/contracts.ts`, `mobile/src/api/client.ts`, `mobile/app/balances.tsx`, `mobile/app/(tabs)/index.tsx`, `mobile/app/movements/new.tsx`, `mobile/app/transfers/new.tsx`, `mobile/src/features/movements/MovementForm.tsx`, `mobile/src/features/ledger/MovementList.tsx`, `mobile/src/features/ledger/selectors.ts`.

**Interfaces:** Contratos móviles reflejan cuentas del API; el formulario de retiro crea transferencia banco→efectivo.

- [x] Añadir prueba de resumen para múltiples bancos y Débito total.
- [x] Convertir opciones de cuenta a dinámicas y permitir varias cuentas en saldos iniciales.
- [x] Añadir acción y formulario Retirar; mantener transferencias ordinarias.
- [x] Ejecutar `npm run test:mobile` y `npm run typecheck`.

### Task 4: Cambio seguro de contraseña en API

**Files:** `server/auth.ts`, `server/auth-store.ts`, `server/auth-middleware.ts` si se requiere, `server/auth-routes.test.ts`.

**Interfaces:** `POST /api/auth/password` acepta bearer autenticado y `{ currentPassword, newPassword, confirmPassword }`; `AuthStore` carga propietario único y cambia hash/revoca sesiones atómicamente.

- [x] Escribir pruebas para no autenticado, clave actual incorrecta, confirmación distinta y cambio correcto con revocación total.
- [x] Ejecutar `npm run test:server` y confirmar fallos esperados.
- [x] Implementar validación, hash Argon2id, cambio transaccional y cookie web limpia.
- [x] Ejecutar `npm run test:server`.

### Task 5: Cambio de contraseña en web y Android

**Files:** `src/auth.ts`, `src/AuthGate.tsx`, `src/App.tsx`, `mobile/src/auth/session.ts`, `mobile/app/(tabs)/index.tsx`, `mobile/app/password.tsx`, `mobile/src/auth/session.test.ts`.

**Interfaces:** Ambos clientes llaman al endpoint protegido, limpian su sesión local al recibir éxito y vuelven al login.

- [x] Escribir prueba móvil que confirme que un cambio correcto borra el refresh token local.
- [x] Ejecutar `npm run test:mobile` y confirmar el fallo esperado.
- [x] Añadir formulario web y móvil con clave actual, nueva y confirmación.
- [x] Ejecutar `npm run test:mobile`, `npm run test:web`, `npm run test:server`, `npm run build` y typecheck móvil.

### Task 6: Validación final y despliegue pendiente

- [x] Ejecutar `npm run db:migrate` solo contra base local; la segunda corrida reportó `No hay migraciones pendientes.`
- [x] Revisar `git diff --check` y los cambios completos.
- [ ] Compilar, instalar y abrir la versión nueva en el emulador. Build bloqueado por rutas largas de Windows en Ninja: `ninja: error: mkdir(CMakeFiles/rnscreens.dir/C_/Users/usuario01/Documents/GABRIEL_MURILLO/estados_financieros/mobile/node_modules/react-native-screens): No such file or directory`.
- [ ] Repetir flujo autenticado cuando la red del emulador confíe en TLS; no omitir validación de certificados. La red actual aún falla con `Trust anchor for certification path not found`.
- [ ] Entregar instrucciones de despliegue. No ejecutar migración de Supabase, push ni deploy durante esta tarea.
